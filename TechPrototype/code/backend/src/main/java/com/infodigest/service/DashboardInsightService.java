package com.infodigest.service;

import com.infodigest.entity.UserReport;
import com.infodigest.entity.ReportType;
import com.infodigest.repository.UserReportRepository;
import com.infodigest.repository.UserRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
@Slf4j
public class DashboardInsightService {

    @Autowired
    private UserReportRepository userReportRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private AIService aiService;

    private static final String DASHBOARD_INSIGHT_PROMPT_TEMPLATE = """
        你是一个专业的数字内容营养师。请根据用户近期的日报数据，生成一段简洁有力的洞察金句。

        用户近期日报摘要：
        %s

        要求：
        1. 总结用户近期的信息摄入趋势和特点
        2. 发现用户的关注点变化或知识积累模式
        3. 给出建议性的洞察或值得注意的现象
        4. 语言风格：专业、简洁、有洞察力
        5. 长度：1-2句话的摘要 + 2-3句话的详细洞察

        请返回 JSON 格式：
        {
          "summary": "一句话摘要（用于卡片预览，50字以内）",
          "fullText": "完整洞察内容（200字以内）",
          "title": "洞察标题（10字以内）"
        }
        """;

    /**
     * 为指定用户生成仪表盘 AI 洞察
     * 优先使用近3天的日报，如果不足则使用近7天的
     */
    @Transactional
    public void generateDashboardInsight(Long userId) {
        try {
            log.info("开始为用户 {} 生成仪表盘洞察", userId);

            // 查找近3天的日报
            LocalDate today = LocalDate.now();
            LocalDate threeDaysAgo = today.minusDays(3);
            LocalDate sevenDaysAgo = today.minusDays(7);

            // 优先查找近3天（不包括今天）
            List<UserReport> recentReports = userReportRepository.findByUserIdAndTypeAndReportDateBetween(
                    userId, ReportType.DAILY, threeDaysAgo, today.minusDays(1)
            );

            // 如果近3天没有日报，则查找近7天
            if (recentReports.isEmpty()) {
                log.info("用户 {} 近3天无日报，查找近7天", userId);
                recentReports = userReportRepository.findByUserIdAndTypeAndReportDateBetween(
                        userId, ReportType.DAILY, sevenDaysAgo, today.minusDays(1)
                );
            }

            // 如果近7天也没有，无法生成洞察
            if (recentReports.isEmpty()) {
                log.warn("用户 {} 近7天无日报数据，无法生成洞察", userId);
                return;
            }

            // 构建日报摘要
            StringBuilder reportSummary = new StringBuilder();
            for (UserReport report : recentReports) {
                reportSummary.append("【").append(report.getReportDate()).append("】\n");
                if (report.getInsightTitle() != null && report.getInsightSummary() != null) {
                    reportSummary.append(report.getInsightTitle()).append(": ")
                            .append(report.getInsightSummary()).append("\n\n");
                } else {
                    reportSummary.append("暂无洞察内容\n\n");
                }
            }

            String prompt = String.format(DASHBOARD_INSIGHT_PROMPT_TEMPLATE, reportSummary.toString());

            // 调用 AI 生成洞察
            String aiResponse = aiService.generateInsight(prompt, userId);

            // 解析 AI 返回的 JSON
            com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            com.fasterxml.jackson.databind.JsonNode jsonNode = mapper.readTree(aiResponse);

            String title = jsonNode.has("title") ? jsonNode.get("title").asText() : "AI 洞察";
            String summary = jsonNode.has("summary") ? jsonNode.get("summary").asText() : "";
            String fullText = jsonNode.has("fullText") ? jsonNode.get("fullText").asText() : aiResponse;

            // 查找或创建今天的特殊报告（用于存储仪表盘洞察）
            Optional<UserReport> existingReport = userReportRepository
                    .findByUserIdAndTypeAndReportDate(userId, ReportType.DAILY, today);

            UserReport dashboardReport;
            if (existingReport.isPresent()) {
                dashboardReport = existingReport.get();
                dashboardReport.setInsightTitle(title);
                dashboardReport.setInsightSummary(summary);
                dashboardReport.setInsightFullText(fullText);
                dashboardReport.setVersion(dashboardReport.getVersion() + 1);
            } else {
                dashboardReport = new UserReport();
                dashboardReport.setUserId(userId);
                dashboardReport.setType(ReportType.DAILY);
                dashboardReport.setReportDate(today);
                dashboardReport.setInsightTitle(title);
                dashboardReport.setInsightSummary(summary);
                dashboardReport.setInsightFullText(fullText);
                dashboardReport.setCreatedAt(LocalDateTime.now());
                dashboardReport.setUpdatedAt(LocalDateTime.now());
                dashboardReport.setVersion(1);
            }

            userReportRepository.save(dashboardReport);
            log.info("用户 {} 的仪表盘洞察生成完成", userId);

        } catch (Exception e) {
            log.error("为用户 {} 生成仪表盘洞察失败: {}", userId, e.getMessage(), e);
            throw new RuntimeException("生成洞察失败: " + e.getMessage());
        }
    }

    /**
     * 获取用户当前的仪表盘洞察
     * 返回格式适配前端 AIQuoteCard 组件
     */
    public java.util.Map<String, Object> getDashboardInsight(Long userId) {
        LocalDate today = LocalDate.now();

        // 先尝试获取今天的洞察
        Optional<UserReport> todayReport = userReportRepository
                .findByUserIdAndTypeAndReportDate(userId, ReportType.DAILY, today);

        UserReport report = null;

        if (todayReport.isPresent() && todayReport.get().getInsightSummary() != null) {
            report = todayReport.get();
        } else {
            // 如果今天没有，获取最近的一条
            List<UserReport> recentReports = userReportRepository
                    .findTop1ByUserIdAndTypeOrderByReportDateDesc(userId, ReportType.DAILY);
            if (!recentReports.isEmpty() && recentReports.get(0).getInsightSummary() != null) {
                report = recentReports.get(0);
            }
        }

        java.util.Map<String, Object> result = new java.util.LinkedHashMap<>();

        if (report != null) {
            result.put("id", report.getId());
            result.put("summary", report.getInsightSummary() != null ? report.getInsightSummary() : "暂无洞察");
            result.put("fullText", report.getInsightFullText() != null ? report.getInsightFullText() : "近期未有分析结果");
            result.put("sourcePlatform", "InfoDigest · 数字饮食分析");
            result.put("sourceLink", "#");
            result.put("tags", java.util.List.of("洞察", "趋势分析"));
            result.put("hasData", true);
        } else {
            // 没有数据时返回默认内容
            result.put("id", 0);
            result.put("summary", "近期未有分析结果");
            result.put("fullText", "近期未有分析结果，请先生成日报或等待系统自动分析。");
            result.put("sourcePlatform", "InfoDigest · 数字饮食分析");
            result.put("sourceLink", "#");
            result.put("tags", java.util.List.of());
            result.put("hasData", false);
        }

        return result;
    }
}
