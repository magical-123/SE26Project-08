package com.infodigest.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.infodigest.entity.InformationItem;
import com.infodigest.entity.ReportType;
import com.infodigest.entity.UserReport;
import com.infodigest.repository.InformationItemRepository;
import com.infodigest.repository.UserReportRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.DayOfWeek;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * 洞察生成服务
 */
@Service
@Slf4j
public class InsightService {

    @Autowired
    private UserReportRepository reportRepository;

    @Autowired
    private InformationItemRepository itemRepository;

    @Autowired
    private AIService aiService;

    @Autowired
    private ObjectMapper objectMapper;

    private static final String INSIGHT_PROMPT_TEMPLATE = """
            你是一位专业的数字内容分析师。请基于用户在%s的视频观看数据生成一份深度洞察报告。

            【用户数据】
            - 时间范围：%s
            - 观看视频数量：%d
            - 五维度营养分布：
              * 蛋白质（深度认知）：%d%%
              * 碳水化合物（实用技能）：%d%%
              * 维生素（创意灵感）：%d%%
              * 脂肪（娱乐消遣）：%d%%
              * 膳食纤维（哲思反思）：%d%%

            【视频列表】
            %s

            请生成一份洞察报告，包含以下内容：
            1. **标题**：简洁有力的主题标题（10字以内）
            2. **核心洞察**：用2-3句话概括本%s最突出的特点和趋势
            3. **关键发现**：列出3个关键发现点，每个用一句话说明
            4. **建议**：给出1-2条针对性的内容摄入建议

            请用JSON格式返回：
            {
              "title": "洞察标题",
              "summary": "核心洞察（2-3句话）",
              "fullText": "完整洞察内容，包含关键发现和建议"
            }
            """;

    private static final String WEEKLY_INSIGHT_PROMPT_TEMPLATE = """
            你是一位专业的数字内容分析师。请基于用户本周的每日洞察报告生成一份周度总结报告。

            【本周数据】
            - 时间范围：%s
            - 本周五维度营养分布：
              * 蛋白质（深度认知）：%d%%
              * 碳水化合物（实用技能）：%d%%
              * 维生素（创意灵感）：%d%%
              * 脂肪（娱乐消遣）：%d%%
              * 膳食纤维（哲思反思）：%d%%

            【每日洞察汇总】
            %s

            请生成一份周报，包含以下内容：
            1. **标题**：简洁有力的主题标题（10字以内）
            2. **核心洞察**：用3-4句话概括本周整体的内容消费特点和变化趋势
            3. **关键发现**：列出3-4个关键发现点，可以包括：
               - 本周营养摄入的亮点和不足
               - 与上周相比的明显变化
               - 持续的兴趣点或新出现的关注领域
            4. **建议**：给出2-3条针对下周的内容摄入建议

            请用JSON格式返回：
            {
              "title": "周报标题",
              "summary": "核心洞察（3-4句话）",
              "fullText": "完整周报内容，包含关键发现和建议"
            }
            """;

    /**
     * 生成或重新生成洞察
     */
    public UserReport generateInsight(Long userId, ReportType type, LocalDate reportDate) throws Exception {
        log.info("开始为用户 {} 生成 {} 洞察，日期：{}", userId, type, reportDate);

        if (type == ReportType.WEEKLY) {
            // 周报：基于日报生成
            return generateWeeklyInsightFromDailyReports(userId, reportDate);
        } else {
            // 日报：基于视频列表生成
            return generateDailyInsightFromVideos(userId, reportDate);
        }
    }

    /**
     * 基于视频列表生成日报
     */
    private UserReport generateDailyInsightFromVideos(Long userId, LocalDate reportDate) throws Exception {
        log.info("基于视频列表生成日报：userId={}, date={}", userId, reportDate);

        // 1. 获取当天的所有已分析视频
        List<InformationItem> items = itemRepository
                .findByUserIdAndProcessStatusAndAnalyzedAtBetween(
                        userId, "PROCESSED",
                        reportDate.atStartOfDay(),
                        reportDate.atTime(23, 59, 59)
                );

        if (items.isEmpty()) {
            throw new RuntimeException("该日期没有已分析的视频数据");
        }

        // 2. 计算营养分布
        Map<String, Integer> nutrition = calculateNutritionDistribution(items);

        // 3. 构建提示词
        String videoList = buildVideoList(items);
        String timeRange = reportDate.toString();
        String periodName = "日";

        String prompt = String.format(
                INSIGHT_PROMPT_TEMPLATE,
                periodName,
                timeRange,
                items.size(),
                nutrition.get("protein"),
                nutrition.get("carbs"),
                nutrition.get("vitamins"),
                nutrition.get("fats"),
                nutrition.get("fiber"),
                videoList,
                periodName
        );

        // 4. 调用 AI 生成洞察
        log.info("调用 AI 生成日报洞察...");
        String aiResponse = aiService.generateInsight(prompt, userId);

        // 5. 解析 AI 响应
        Map<String, String> insightData = parseInsightResponse(aiResponse);

        // 6. 保存报告
        return saveReport(userId, ReportType.DAILY, reportDate, nutrition, insightData);
    }

    /**
     * 基于每日报告生成周报
     */
    private UserReport generateWeeklyInsightFromDailyReports(Long userId, LocalDate reportDate) throws Exception {
        log.info("基于日报生成周报：userId={}, date={}", userId, reportDate);

        // 1. 计算周的日期范围（周一到周日）
        LocalDate startDate = reportDate.with(DayOfWeek.MONDAY);
        LocalDate endDate = reportDate.with(DayOfWeek.SUNDAY);

        // 2. 获取本周所有日报
        List<UserReport> dailyReports = reportRepository.findByUserIdAndTypeAndReportDateBetween(
                userId, ReportType.DAILY, startDate, endDate);

        if (dailyReports.isEmpty()) {
            throw new RuntimeException("本周还没有任何日报，请先生成日报");
        }

        // 3. 计算本周整体营养分布（基于所有视频的时间范围）
        List<InformationItem> weekItems = itemRepository
                .findByUserIdAndProcessStatusAndAnalyzedAtBetween(
                        userId, "PROCESSED",
                        startDate.atStartOfDay(),
                        endDate.atTime(23, 59, 59)
                );

        Map<String, Integer> weeklyNutrition = calculateNutritionDistribution(weekItems);

        // 4. 构建每日洞察汇总文本
        String dailyInsightsSummary = buildDailyInsightsSummary(dailyReports);

        // 5. 构建周报提示词
        String timeRange = startDate + " 至 " + endDate;
        String prompt = String.format(
                WEEKLY_INSIGHT_PROMPT_TEMPLATE,
                timeRange,
                weeklyNutrition.get("protein"),
                weeklyNutrition.get("carbs"),
                weeklyNutrition.get("vitamins"),
                weeklyNutrition.get("fats"),
                weeklyNutrition.get("fiber"),
                dailyInsightsSummary
        );

        // 6. 调用 AI 生成周报洞察
        log.info("调用 AI 生成周报洞察...");
        String aiResponse = aiService.generateInsight(prompt, userId);

        // 7. 解析 AI 响应
        Map<String, String> insightData = parseInsightResponse(aiResponse);

        // 8. 保存周报（reportDate 使用周一日期）
        return saveReport(userId, ReportType.WEEKLY, startDate, weeklyNutrition, insightData);
    }

    /**
     * 保存报告（统一处理版本管理）
     */
    private UserReport saveReport(Long userId, ReportType type, LocalDate reportDate,
                                   Map<String, Integer> nutrition, Map<String, String> insightData) throws Exception {
        // 查找是否已有该日期的报告
        Optional<UserReport> existingReport = reportRepository
                .findFirstByUserIdAndTypeAndReportDateOrderByVersionDesc(userId, type, reportDate);

        UserReport report;
        if (existingReport.isPresent()) {
            // 重新生成：创建新版本
            UserReport oldReport = existingReport.get();
            report = new UserReport();
            report.setUserId(userId);
            report.setType(type);
            report.setReportDate(reportDate);
            report.setVersion(oldReport.getVersion() + 1);
        } else {
            // 首次生成
            report = new UserReport();
            report.setUserId(userId);
            report.setType(type);
            report.setReportDate(reportDate);
            report.setVersion(1);
        }

        // 填充报告数据
        report.setNutritionData(objectMapper.writeValueAsString(nutrition));
        report.setInsightTitle(insightData.get("title"));
        report.setInsightSummary(insightData.get("summary"));
        report.setInsightFullText(insightData.get("fullText"));

        // 保存报告
        report = reportRepository.save(report);
        log.info("报告生成完成：type={}, reportDate={}, version={}", type, reportDate, report.getVersion());

        return report;
    }

    /**
     * 构建每日洞察汇总文本
     */
    private String buildDailyInsightsSummary(List<UserReport> dailyReports) {
        StringBuilder sb = new StringBuilder();
        int dayNum = 1;

        for (UserReport report : dailyReports) {
            sb.append(String.format("【%s %s】\n",
                    report.getReportDate().getDayOfWeek().toString(),
                    report.getReportDate()));
            sb.append(String.format("标题：%s\n", report.getInsightTitle()));
            sb.append(String.format("核心洞察：%s\n", report.getInsightSummary()));
            sb.append("\n");
            dayNum++;
        }

        return sb.toString();
    }

    /**
     * 获取最新洞察
     */
    public Optional<UserReport> getLatestInsight(Long userId, ReportType type, LocalDate reportDate) {
        return reportRepository.findFirstByUserIdAndTypeAndReportDateOrderByVersionDesc(
                userId, type, reportDate);
    }

    /**
     * 获取历史洞察列表
     */
    public List<UserReport> getHistoryInsights(Long userId, ReportType type, LocalDate reportDate) {
        return reportRepository.findByUserIdAndTypeAndReportDateOrderByVersionDesc(
                userId, type, reportDate);
    }

    /**
     * 获取所有历史报告（每个日期只返回最新版本）
     */
    public List<UserReport> getAllHistoryReports(Long userId, ReportType type) {
        return reportRepository.findLatestReportsByUserIdAndType(userId, type);
    }

    /**
     * 计算营养分布
     */
    private Map<String, Integer> calculateNutritionDistribution(List<InformationItem> items) {
        long proteinSum = 0, carbsSum = 0, vitaminsSum = 0, fatsSum = 0, fiberSum = 0;

        for (InformationItem item : items) {
            if (item.getNutritionProtein() != null) proteinSum += item.getNutritionProtein();
            if (item.getNutritionCarbs() != null) carbsSum += item.getNutritionCarbs();
            if (item.getNutritionVitamins() != null) vitaminsSum += item.getNutritionVitamins();
            if (item.getNutritionFats() != null) fatsSum += item.getNutritionFats();
            if (item.getNutritionFiber() != null) fiberSum += item.getNutritionFiber();
        }

        int count = items.size();
        int avgProtein = (int) (proteinSum / count);
        int avgCarbs = (int) (carbsSum / count);
        int avgVitamins = (int) (vitaminsSum / count);
        int avgFats = (int) (fatsSum / count);
        int avgFiber = (int) (fiberSum / count);

        // 归一化到 100%
        int total = avgProtein + avgCarbs + avgVitamins + avgFats + avgFiber;
        if (total > 0) {
            avgProtein = (int) Math.round(avgProtein * 100.0 / total);
            avgCarbs = (int) Math.round(avgCarbs * 100.0 / total);
            avgVitamins = (int) Math.round(avgVitamins * 100.0 / total);
            avgFats = (int) Math.round(avgFats * 100.0 / total);
            avgFiber = 100 - avgProtein - avgCarbs - avgVitamins - avgFats;
        }

        Map<String, Integer> result = new HashMap<>();
        result.put("protein", avgProtein);
        result.put("carbs", avgCarbs);
        result.put("vitamins", avgVitamins);
        result.put("fats", avgFats);
        result.put("fiber", avgFiber);

        return result;
    }

    /**
     * 构建视频列表文本（包含摘要）
     */
    private String buildVideoList(List<InformationItem> items) {
        StringBuilder sb = new StringBuilder();
        int count = 0;
        for (InformationItem item : items) {
            if (count >= 10) break; // 最多列出10个
            sb.append(String.format(
                    "%d. [%s] %s\n   营养分布：蛋白质:%d%% 碳水:%d%% 维生素:%d%% 脂肪:%d%% 纤维:%d%%\n   摘要：%s\n\n",
                    ++count,
                    item.getPlatform(),
                    item.getTitle(),
                    item.getNutritionProtein() != null ? item.getNutritionProtein() : 0,
                    item.getNutritionCarbs() != null ? item.getNutritionCarbs() : 0,
                    item.getNutritionVitamins() != null ? item.getNutritionVitamins() : 0,
                    item.getNutritionFats() != null ? item.getNutritionFats() : 0,
                    item.getNutritionFiber() != null ? item.getNutritionFiber() : 0,
                    item.getAiSummary() != null ? item.getAiSummary() : "暂无摘要"
            ));
        }
        if (items.size() > 10) {
            sb.append(String.format("... 还有 %d 个视频未列出\n", items.size() - 10));
        }
        return sb.toString();
    }

    /**
     * 解析 AI 响应
     */
    private Map<String, String> parseInsightResponse(String response) throws Exception {
        // 清理可能的 markdown 代码块标记
        String cleanedResponse = response.trim();
        if (cleanedResponse.startsWith("```json")) {
            cleanedResponse = cleanedResponse.substring(7).trim();
        }
        if (cleanedResponse.startsWith("```")) {
            cleanedResponse = cleanedResponse.substring(3).trim();
        }
        if (cleanedResponse.endsWith("```")) {
            cleanedResponse = cleanedResponse.substring(0, cleanedResponse.length() - 3).trim();
        }

        // 解析 JSON
        @SuppressWarnings("unchecked")
        Map<String, String> result = objectMapper.readValue(cleanedResponse, Map.class);

        // 验证必需字段
        if (!result.containsKey("title") || !result.containsKey("summary") || !result.containsKey("fullText")) {
            throw new RuntimeException("AI 返回的 JSON 格式不正确，缺少必需字段");
        }

        return result;
    }
}
