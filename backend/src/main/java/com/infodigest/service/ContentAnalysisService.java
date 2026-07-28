package com.infodigest.service;

import com.infodigest.dto.AnalysisResultDTO;
import com.infodigest.dto.AnalysisResultDTO.QuoteItem;
import com.infodigest.entity.AIConfig;
import com.infodigest.entity.InformationItem;
import com.infodigest.entity.QuoteExtract;
import com.infodigest.repository.AIConfigRepository;
import com.infodigest.repository.InformationItemRepository;
import com.infodigest.repository.QuoteExtractRepository;
import com.infodigest.repository.UserRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@Slf4j
public class ContentAnalysisService {

    @Autowired
    private InformationItemRepository itemRepository;

    @Autowired
    private AIConfigRepository configRepository;

    @Autowired
    private AIService aiService;

    @Autowired
    private AiSummaryService aiSummaryService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private QuoteExtractRepository quoteExtractRepository;

    private static final int MAX_CONTENT_LENGTH = 100000;  // 提升到100k，支持完整字幕分析

    private static final String SYSTEM_PROMPT = """
        你是一个专业的数字内容营养师。请分析以下视频内容，按照"数字饮食营养成分"模型进行评估。

        请为视频在以下 5 个维度分配百分比（总和必须为 100%）：

        🥩 1. 蛋白质 (protein) —— 深度认知与硬核知识
        定义：能够构建个人认知护城河的底层逻辑、学术论文、长篇深度分析、基础科学。
        特点：难咀嚼、不易消化（需要高度专注），但能带来长期的心智成长。
        例如：《大语言模型 Transformer 架构的数学推导》、《人类简史》。

        🍚 2. 碳水化合物 (carbs) —— 实用技能与行业快讯
        定义：能够快速转化为行动力、拿来就用的工具技巧，或是最新的行业新闻动态。
        特点：消化快，能提供快速的"能量"，看完立刻就能用上，但半衰期较短。
        例如：《10分钟教你用 React 19 新特性》、《今日 AI 圈五件大事》。

        🍊 3. 维生素 (vitamins) —— 创意灵感与美学体验
        定义：设计作品、艺术鉴赏、优秀的文案、能够激发大脑产生新点子的小众内容。
        特点：不需要大量或长时间摄入，但不可或缺。能打破思维定势，让大脑保持活跃。
        例如：《2026年最佳网页动效赏析》、《宫崎骏的色彩哲学》。

        🍔 4. 脂肪与糖分 (fats) —— 纯娱乐与情绪多巴胺
        定义：搞笑短视频、无脑爽剧、明星八卦、情绪煽动型的口水文。
        特点：口感极佳，能瞬间飙升多巴胺，但毫无长期价值。适量摄入可以解压，但过量会导致"数字肥胖"。
        例如：《某网红最新狗血大瓜》、《3分钟看完这部爽剧》。

        🥬 5. 膳食纤维 (fiber) —— 哲思与心理复原力
        定义：哲学探讨、心理疏导、历史宏观感悟、慢节奏的自然纪录片或人物访谈。
        特点：不能立刻教你赚钱，也不能让你发笑，但能清理大脑的"信息垃圾"，缓解焦虑。
        例如：《项飙：把自己作为方法》、《地球脉动》。

        评分规则：
        - 5 个维度的百分比总和必须等于 100
        - 根据视频的实际内容分配比例
        - 一个视频通常会有 1-2 个主导维度
        - 即使某个维度占比很小，也要如实评估

        视频信息：
        标题：{title}
        来源：{platform}
        时长：{duration}分钟
        内容：
        {content}

        JSON 中的"quotes"字段为可选，请判断内容中是否存在值得记录的金句（如精辟的观点、令人警醒的洞察、优美的表达等）。
        如果没有值得摘录的内容，quotes 字段可为空数组。建议每条内容最多提取 3 条金句。

        请返回 JSON 格式（注意：百分比用整数表示，不要带%符号）：
        {
          "protein": 50,
          "carbs": 30,
          "vitamins": 5,
          "fats": 5,
          "fiber": 10,
          "reasoning": "该视频以深度技术讲解为主（蛋白质50%），同时包含大量实用代码示例（碳水30%），有一定思维启发（纤维10%），设计审美和娱乐成分较少（各5%）",
          "summary": "本视频系统讲解微服务架构设计...",
          "quotes": [
            {"text": "架构设计本质上是关于如何管理复杂性", "reason": "对架构本质的精辟定义"},
            {"text": "好的系统不是设计出来的，而是演进出来的", "reason": "引发对系统设计方法论的反思"}
          ]
        }

        如果没有金句，"quotes" 返回空数组即可。

        请确保 protein + carbs + vitamins + fats + fiber = 100
        """;

    private static final String SELF_PORTRAIT_BLOCK = """

        附加信息——用户的个人需求描述：
        该用户对自己的描述如下。请结合这些信息，评估该内容对这位具体用户的参考价值：
        {selfPortrait}
        """;

    public void analyzeItem(Long itemId) throws Exception {
        InformationItem item = itemRepository.findById(itemId)
                .orElseThrow(() -> new RuntimeException("Item not found: " + itemId));

        boolean hasFullData = item.getAiSummary() != null && !item.getAiSummary().isEmpty();
        // 检查营养评分字段是否存在，而不是只看status
        boolean hasNutrition = item.getNutritionProtein() != null &&
                               item.getNutritionCarbs() != null &&
                               item.getNutritionVitamins() != null &&
                               item.getNutritionFats() != null &&
                               item.getNutritionFiber() != null;
        boolean hasSummary = hasFullData;

        // 如果营养分析和 AI 摘要都有了，跳过
        if (hasNutrition && hasSummary) {
            log.info("Item {} already fully processed, skipping", itemId);
            return;
        }

        AIConfig config = configRepository.findByUserId(item.getUserId())
                .orElseThrow(() -> new RuntimeException("AI config not found for user: " + item.getUserId()));

        log.info("Starting full analysis for item {} (status={}, hasSummary={}, hasNutrition={})",
                itemId, item.getProcessStatus(), item.getAiSummary() != null, hasNutrition);

        // 1. 营养分析（如果还没做）
        if (!hasNutrition) {
            // 获取用户自画像，用于个性化 AI 价值判断
            String selfPortrait = userRepository.findById(item.getUserId())
                    .map(u -> u.getSelfPortrait())
                    .filter(s -> s != null && !s.trim().isEmpty())
                    .orElse(null);

            String userPrompt = buildContentPrompt(item, SYSTEM_PROMPT, selfPortrait);

            try {
                AnalysisResultDTO result = aiService.analyze(config, "", userPrompt);

                // 使用局部更新，仅更新 AI 分析相关字段，避免覆盖用户在 AI 分析期间的手动修改（如 userNote, isPremium）
                itemRepository.updateAnalysisFields(
                        itemId,
                        result.getProtein(),
                        result.getCarbs(),
                        result.getVitamins(),
                        result.getFats(),
                        result.getFiber(),
                        result.getReasoning(),
                        result.getSummary(),
                        LocalDateTime.now()
                );

                log.info("Nutrition analysis completed for item {}: protein={}, carbs={}, vitamins={}, fats={}, fiber={}",
                        itemId, result.getProtein(), result.getCarbs(), result.getVitamins(),
                        result.getFats(), result.getFiber());

                // 3. 保存 AI 提取的金句（如果有）
                saveQuotesFromAnalysis(result, item);

            } catch (Exception e) {
                String msg = e.getMessage() != null ? e.getMessage() : "";
                if (msg.contains("429") || msg.toLowerCase().contains("rate limit")) {
                    log.warn("⚠️ Nutrition analysis rate-limited for item {}, will retry next round", itemId);
                    itemRepository.updateProcessStatus(itemId, "UNPROCESSED");
                    // 将 429 异常继续上抛，让调度器决定是否停止本轮
                    throw e;
                } else {
                    log.error("Nutrition analysis failed for item {}: {}", itemId, msg, e);
                    // 非速率限制的错误，标记为 FAILED 避免反复重试
                    itemRepository.updateProcessStatus(itemId, "FAILED");
                }
            }
        }

        // 2. AI 摘要生成（如果还没有摘要）
        if (!hasSummary) {
            try {
                // 重新从数据库加载最新的 item 状态（营养分析可能刚完成）
                Optional<InformationItem> freshItem = itemRepository.findById(itemId);
                if (freshItem.isPresent()) {
                    boolean ok = aiSummaryService.generateSummary(freshItem.get());
                    if (ok) {
                        InformationItem updated = freshItem.get();
                        itemRepository.updateAiSummaryFields(
                                itemId,
                                updated.getAiSummary(),
                                updated.getKnowledgeScore(),
                                updated.getScoreReasoning(),
                                updated.getCategory(),
                                LocalDateTime.now()
                        );
                        log.info("✅ AI summary generated for item {}: score={}, category={}",
                                itemId, updated.getKnowledgeScore(), updated.getCategory());
                    } else {
                        log.warn("AI summary generation returned false for item {}", itemId);
                    }
                }
            } catch (Exception e) {
                log.error("AI summary generation failed for item {}: {}", itemId, e.getMessage());
                // 不抛异常：营养分析已经成功，摘要可以下次调度重试
            }
        }

        // 3. 清空字幕内容（AI分析完成后不再需要存储）
        // 只有当营养分析和AI摘要都完成后才清空，避免中途失败导致数据丢失
        if (hasNutrition || !hasSummary) {
            // 重新检查是否都已完成
            Optional<InformationItem> finalItem = itemRepository.findById(itemId);
            if (finalItem.isPresent()) {
                InformationItem item2 = finalItem.get();
                boolean allDone = item2.getNutritionProtein() != null &&
                                  item2.getAiSummary() != null &&
                                  !item2.getAiSummary().isEmpty();
                if (allDone && item2.getContentRaw() != null && !item2.getContentRaw().isEmpty()) {
                    // Preserve captured source text for provenance, re-analysis and classification.
                    log.debug("Preserved source content for item {} after AI processing ({} chars)",
                            itemId, item2.getContentRaw().length());
                }
            }
        }
    }

    private String buildContentPrompt(InformationItem item, String template, String selfPortrait) {
        String content = item.getContentRaw();
        if (content != null && content.length() > MAX_CONTENT_LENGTH) {
            content = truncateContent(content, MAX_CONTENT_LENGTH);
        }

        String prompt = template
                .replace("{title}", item.getTitle() != null ? item.getTitle() : "")
                .replace("{platform}", item.getPlatform() != null ? item.getPlatform() : "")
                .replace("{duration}", item.getDurationMinutes() != null ? String.valueOf(item.getDurationMinutes()) : "未知")
                .replace("{content}", content != null ? content : "");

        // 如果用户有自画像，追加到 prompt 末尾
        if (selfPortrait != null && !selfPortrait.trim().isEmpty()) {
            prompt += SELF_PORTRAIT_BLOCK.replace("{selfPortrait}", selfPortrait);
        }

        return prompt;
    }

    private String truncateContent(String content, int maxLength) {
        if (content.length() <= maxLength) {
            return content;
        }

        int headLength = (int) (maxLength * 0.6);
        int tailLength = (int) (maxLength * 0.3);

        String head = content.substring(0, Math.min(headLength, content.length()));
        String tail = content.length() > headLength + tailLength
                ? content.substring(content.length() - tailLength)
                : "";

        return head + "\n\n[... 内容省略 ...]\n\n" + tail;
    }

    /**
     * 保存 AI 分析结果中提取的金句到 quote_extracts 表
     * <p>
     * 会对每句金句做原文匹配校验：如果 AI 返回的句子在视频字幕原文中不存在，则丢弃（防幻觉）。
     */
    private void saveQuotesFromAnalysis(AnalysisResultDTO result, InformationItem item) {
        List<QuoteItem> quotes = result.getQuotes();
        if (quotes == null || quotes.isEmpty()) {
            log.debug("No quotes extracted for item {}", item.getId());
            return;
        }

        String originalContent = item.getContentRaw(); // 此时 contentRaw 还是完整的字幕文本

        // 先删除该条目之前可能存在的金句（防止重复分析导致重复存储）
        List<QuoteExtract> existing = quoteExtractRepository.findByItemId(item.getId());
        if (!existing.isEmpty()) {
            quoteExtractRepository.deleteAll(existing);
        }

        List<QuoteExtract> toSave = quotes.stream()
                .filter(q -> q.getText() != null && !q.getText().isBlank())
                .filter(q -> {
                    // 原文匹配校验：金句必须出现在字幕原文中
                    if (originalContent == null || originalContent.isBlank()) {
                        log.warn("No original content available to validate quote for item {}, skipping all quotes", item.getId());
                        return false;
                    }
                    boolean matches = originalContent.contains(q.getText().trim());
                    if (!matches) {
                        log.warn("⚠️ Quote mismatch detected for item {}: \"{}\" not found in original content, discarding",
                                item.getId(), q.getText().trim());
                    }
                    return matches;
                })
                .map(q -> {
                    QuoteExtract qe = new QuoteExtract();
                    qe.setUserId(item.getUserId());
                    qe.setItemId(item.getId());
                    qe.setContent(q.getText().trim());
                    qe.setReason(q.getReason());
                    qe.setSourceTitle(item.getTitle());
                    qe.setSourceUrl(item.getUrl());
                    qe.setSourcePlatform(item.getPlatform());
                    return qe;
                })
                .collect(Collectors.toList());

        if (!toSave.isEmpty()) {
            quoteExtractRepository.saveAll(toSave);
            log.info("✅ Saved {} quotes for item {} (title: {})", toSave.size(), item.getId(), item.getTitle());
        }
    }
}
