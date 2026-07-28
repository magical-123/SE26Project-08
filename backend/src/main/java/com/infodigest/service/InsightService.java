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

            重要：报告中凡是提到营养维度百分比，必须严格使用上方“本周五维度营养分布”的数值，
            禁止根据每日洞察自行重新计算、推测或改写百分比。

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

        // 1. 按内容捕获时间统计当天的摄入，避免把延迟分析的内容算到错误日期
        List<InformationItem> items = itemRepository
                .findByUserIdAndProcessStatusAndCrawledAtBetween(
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

        // 1. AI 周报用于解释左侧营养表，因此采用相同的滚动最近 7 天范围。
        LocalDate startDate = reportDate.minusDays(7);
        LocalDate endDate = reportDate;
        // 存储键继续使用自然周周一，兼容既有报告查询和版本历史。
        LocalDate storageDate = reportDate.with(DayOfWeek.MONDAY);

        // 2. 获取本周所有日报
        List<UserReport> dailyReports = reportRepository.findByUserIdAndTypeAndReportDateBetween(
                userId, ReportType.DAILY, startDate, endDate);

        // 3. 获取本周内容。即使历史日报尚未生成，也可以直接从内容生成周报。
        List<InformationItem> weekItems = itemRepository
                .findByUserIdAndProcessStatusAndCrawledAtBetween(
                        userId, "PROCESSED",
                        startDate.atStartOfDay(),
                        endDate.atTime(23, 59, 59)
                );

        if (weekItems.isEmpty()) {
            throw new RuntimeException("本周没有已分析的内容数据");
        }

        Map<String, Integer> weeklyNutrition = calculateNutritionDistribution(weekItems);

        // 4. 优先使用日报汇总；没有历史日报时直接使用本周内容摘要，保证周报链路可独立运行。
        String dailyInsightsSummary = dailyReports.isEmpty()
                ? buildVideoList(weekItems)
                : buildDailyInsightsSummary(dailyReports);

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

        // 8. 保存周报（存储键仍使用周一日期）
        return saveReport(userId, ReportType.WEEKLY, storageDate, weeklyNutrition, insightData);
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
        // 对于周报，需要查询本周的报告（reportDate 为本周周一）
        if (type == ReportType.WEEKLY) {
            LocalDate weekStart = reportDate.with(java.time.DayOfWeek.MONDAY);
            return reportRepository.findFirstByUserIdAndTypeAndReportDateOrderByVersionDesc(
                    userId, type, weekStart);
        }

        // 日报必须仍有当天的已分析内容。报告与原始内容分别持久化，
        // 内容被清理后不能继续把旧报告展示成当天的有效洞察。
        List<InformationItem> dailyItems = itemRepository
                .findByUserIdAndProcessStatusAndCrawledAtBetween(
                        userId,
                        "PROCESSED",
                        reportDate.atStartOfDay(),
                        reportDate.atTime(23, 59, 59)
                );
        if (dailyItems.isEmpty()) {
            return Optional.empty();
        }

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
        if (items == null || items.isEmpty()) {
            return Map.of(
                    "protein", 0,
                    "carbs", 0,
                    "vitamins", 0,
                    "fats", 0,
                    "fiber", 0
            );
        }

        double totalSeconds = 0;
        double proteinSeconds = 0;
        double carbsSeconds = 0;
        double vitaminsSeconds = 0;
        double fatsSeconds = 0;
        double fiberSeconds = 0;

        for (InformationItem item : items) {
            double itemSeconds = getEffectiveDurationSeconds(item);
            totalSeconds += itemSeconds;

            if (item.getNutritionProtein() != null) {
                proteinSeconds += itemSeconds * item.getNutritionProtein() / 100.0;
            }
            if (item.getNutritionCarbs() != null) {
                carbsSeconds += itemSeconds * item.getNutritionCarbs() / 100.0;
            }
            if (item.getNutritionVitamins() != null) {
                vitaminsSeconds += itemSeconds * item.getNutritionVitamins() / 100.0;
            }
            if (item.getNutritionFats() != null) {
                fatsSeconds += itemSeconds * item.getNutritionFats() / 100.0;
            }
            if (item.getNutritionFiber() != null) {
                fiberSeconds += itemSeconds * item.getNutritionFiber() / 100.0;
            }
        }

        int protein;
        int carbs;
        int vitamins;
        int fats;
        int fiber;
        if (totalSeconds > 0) {
            // 与 Dashboard 营养成分表保持一致：按照真实观看时长加权。
            protein = (int) Math.round(proteinSeconds * 100.0 / totalSeconds);
            carbs = (int) Math.round(carbsSeconds * 100.0 / totalSeconds);
            vitamins = (int) Math.round(vitaminsSeconds * 100.0 / totalSeconds);
            fats = (int) Math.round(fatsSeconds * 100.0 / totalSeconds);
            fiber = Math.max(0, 100 - protein - carbs - vitamins - fats);
        } else {
            // 所有内容都没有可靠时长时才退回等权平均，且不伪造观看时长。
            protein = averageNutrition(items, InformationItem::getNutritionProtein);
            carbs = averageNutrition(items, InformationItem::getNutritionCarbs);
            vitamins = averageNutrition(items, InformationItem::getNutritionVitamins);
            fats = averageNutrition(items, InformationItem::getNutritionFats);
            fiber = Math.max(0, 100 - protein - carbs - vitamins - fats);
        }

        return Map.of(
                "protein", protein,
                "carbs", carbs,
                "vitamins", vitamins,
                "fats", fats,
                "fiber", fiber
        );
    }

    private double getEffectiveDurationSeconds(InformationItem item) {
        return DurationMetrics.effectiveSeconds(item);
    }

    private int averageNutrition(
            List<InformationItem> items,
            java.util.function.Function<InformationItem, Integer> getter) {
        return (int) Math.round(items.stream()
                .map(getter)
                .filter(java.util.Objects::nonNull)
                .mapToInt(Integer::intValue)
                .average()
                .orElse(0));
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
