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

    /**
     * 生成或重新生成洞察
     */
    public UserReport generateInsight(Long userId, ReportType type, LocalDate reportDate) throws Exception {
        log.info("开始为用户 {} 生成 {} 洞察，日期：{}", userId, type, reportDate);

        // 1. 计算日期范围
        LocalDate startDate, endDate;
        if (type == ReportType.DAILY) {
            startDate = reportDate;
            endDate = reportDate;
        } else {
            // 周报：从周一到周日
            startDate = reportDate.with(DayOfWeek.MONDAY);
            endDate = reportDate.with(DayOfWeek.SUNDAY);
        }

        // 2. 获取该时间段的所有已分析视频
        List<InformationItem> items = itemRepository
                .findByUserIdAndProcessStatusAndAnalyzedAtBetween(
                        userId, "PROCESSED",
                        startDate.atStartOfDay(),
                        endDate.atTime(23, 59, 59)
                );

        if (items.isEmpty()) {
            throw new RuntimeException("该时间段没有已分析的视频数据");
        }

        // 3. 计算营养分布
        Map<String, Integer> nutrition = calculateNutritionDistribution(items);

        // 4. 构建提示词
        String videoList = buildVideoList(items);
        String timeRange = type == ReportType.DAILY
                ? reportDate.toString()
                : startDate + " 至 " + endDate;
        String periodName = type == ReportType.DAILY ? "日" : "周";

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

        // 5. 调用 AI 生成洞察
        log.info("调用 AI 生成洞察...");
        String aiResponse = aiService.generateInsight(prompt, userId);

        // 6. 解析 AI 响应
        Map<String, String> insightData = parseInsightResponse(aiResponse);

        // 7. 查找是否已有该日期的报告
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

        // 8. 填充报告数据
        report.setNutritionData(objectMapper.writeValueAsString(nutrition));
        report.setInsightTitle(insightData.get("title"));
        report.setInsightSummary(insightData.get("summary"));
        report.setInsightFullText(insightData.get("fullText"));

        // 9. 保存报告
        report = reportRepository.save(report);
        log.info("洞察生成完成，报告ID：{}，版本：{}", report.getId(), report.getVersion());

        return report;
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
     * 构建视频列表文本
     */
    private String buildVideoList(List<InformationItem> items) {
        StringBuilder sb = new StringBuilder();
        int count = 0;
        for (InformationItem item : items) {
            if (count >= 10) break; // 最多列出10个
            sb.append(String.format(
                    "%d. [%s] %s - 蛋白质:%d%% 碳水:%d%% 维生素:%d%% 脂肪:%d%% 纤维:%d%%\n",
                    ++count,
                    item.getPlatform(),
                    item.getTitle(),
                    item.getNutritionProtein() != null ? item.getNutritionProtein() : 0,
                    item.getNutritionCarbs() != null ? item.getNutritionCarbs() : 0,
                    item.getNutritionVitamins() != null ? item.getNutritionVitamins() : 0,
                    item.getNutritionFats() != null ? item.getNutritionFats() : 0,
                    item.getNutritionFiber() != null ? item.getNutritionFiber() : 0
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
