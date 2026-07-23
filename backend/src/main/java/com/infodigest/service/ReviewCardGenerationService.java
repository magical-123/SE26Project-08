package com.infodigest.service;

import com.infodigest.entity.InformationItem;
import com.infodigest.entity.ReviewCard;
import com.infodigest.repository.InformationItemRepository;
import com.infodigest.repository.ReviewCardRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Slf4j
public class ReviewCardGenerationService {

    @Autowired
    private InformationItemRepository informationItemRepository;

    @Autowired
    private ReviewCardRepository reviewCardRepository;

    @Autowired
    private AIService aiService;

    private static final String REVIEW_CARD_PROMPT_TEMPLATE = """
        你是一个专业的学习助手。请从用户最近观看的视频中，选择最有复习价值的内容生成1-5张复习卡片。

        用户最近观看的视频列表：
        %s

        要求：
        1. 从这些视频中选择1-5个最有复习价值的知识点（根据视频质量决定数量）
        2. 每个知识点应该是具体的、可复习的概念或技能
        3. 优先选择深度知识（蛋白质）和实用技能（碳水）类内容
        4. 每张卡片生成简洁的标题和内容摘要
        5. 标题：10字以内的问题或概念
        6. 内容：50字以内的核心知识点总结

        请返回 JSON 格式：
        {
          "cards": [
            {
              "title": "复习卡片标题1（问题形式或概念名称）",
              "content": "核心知识点总结1（50字以内）",
              "sourcePlatform": "来源平台（BILIBILI/ZHIHU/GITHUB）"
            },
            {
              "title": "复习卡片标题2",
              "content": "核心知识点总结2",
              "sourcePlatform": "来源平台"
            }
          ]
        }

        如果这些视频都没有值得复习的内容，返回：
        {
          "cards": []
        }
        """;

    /**
     * 为指定用户生成今日复习卡片
     * 优先从近2天的分析视频中抽取，如果不足则从近4天抽取
     */
    @Transactional
    public void generateTodayReviewCard(Long userId) {
        try {
            log.info("开始为用户 {} 生成今日复习卡片", userId);

            LocalDateTime now = LocalDateTime.now();
            LocalDateTime twoDaysAgo = now.minusDays(2);
            LocalDateTime fourDaysAgo = now.minusDays(4);

            // 优先查找近2天已分析的视频
            List<InformationItem> recentItems = informationItemRepository
                    .findByUserIdAndProcessStatusAndAnalyzedAtAfter(userId, "PROCESSED", twoDaysAgo);

            // 如果近2天没有，查找近4天
            if (recentItems.isEmpty()) {
                log.info("用户 {} 近2天无分析视频，查找近4天", userId);
                recentItems = informationItemRepository
                        .findByUserIdAndProcessStatusAndAnalyzedAtAfter(userId, "PROCESSED", fourDaysAgo);
            }

            // 如果近4天也没有，无法生成复习卡片
            if (recentItems.isEmpty()) {
                log.warn("用户 {} 近4天无分析视频，无法生成复习卡片", userId);
                return;
            }

            // 过滤出有价值的内容（优先蛋白质和碳水）
            List<InformationItem> valuableItems = recentItems.stream()
                    .filter(item -> {
                        Integer protein = item.getNutritionProtein();
                        Integer carbs = item.getNutritionCarbs();
                        // 蛋白质或碳水占比超过30%的视频
                        return (protein != null && protein >= 30) || (carbs != null && carbs >= 30);
                    })
                    .collect(Collectors.toList());

            // 如果没有高价值内容，从所有内容中选择
            if (valuableItems.isEmpty()) {
                valuableItems = recentItems;
            }

            // 随机选择最多5个视频用于生成
            Collections.shuffle(valuableItems);
            List<InformationItem> selectedItems = valuableItems.stream()
                    .limit(5)
                    .collect(Collectors.toList());

            // 构建视频摘要
            StringBuilder videoSummary = new StringBuilder();
            for (int i = 0; i < selectedItems.size(); i++) {
                InformationItem item = selectedItems.get(i);
                videoSummary.append(String.format("[视频%d] %s\n", i + 1, item.getTitle()));
                videoSummary.append(String.format("平台：%s\n", item.getPlatform()));
                if (item.getAiSummary() != null) {
                    videoSummary.append(String.format("摘要：%s\n", item.getAiSummary()));
                }
                videoSummary.append(String.format("营养成分：蛋白质%d%% 碳水%d%% 维生素%d%% 脂肪%d%% 纤维%d%%\n\n",
                        item.getNutritionProtein() != null ? item.getNutritionProtein() : 0,
                        item.getNutritionCarbs() != null ? item.getNutritionCarbs() : 0,
                        item.getNutritionVitamins() != null ? item.getNutritionVitamins() : 0,
                        item.getNutritionFats() != null ? item.getNutritionFats() : 0,
                        item.getNutritionFiber() != null ? item.getNutritionFiber() : 0));
            }

            String prompt = String.format(REVIEW_CARD_PROMPT_TEMPLATE, videoSummary.toString());

            // 调用 AI 生成复习卡片
            String aiResponse = aiService.generateInsight(prompt, userId);

            // 解析 AI 返回的 JSON
            com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            com.fasterxml.jackson.databind.JsonNode jsonNode = mapper.readTree(aiResponse);

            LocalDate today = LocalDate.now();
            // Note: We no longer delete unreviewed cards to allow spaced repetition to work across days.

            // 检查是否有 cards 数组
            if (!jsonNode.has("cards") || !jsonNode.get("cards").isArray()) {
                log.warn("AI 返回格式错误，缺少 cards 数组");
                return;
            }

            com.fasterxml.jackson.databind.JsonNode cardsArray = jsonNode.get("cards");

            // 如果 cards 数组为空，说明没有值得复习的内容
            if (cardsArray.isEmpty()) {
                log.info("用户 {} 的视频中没有值得复习的内容", userId);
                return;
            }

            // 创建多张复习卡片
            int cardCount = 0;
            for (com.fasterxml.jackson.databind.JsonNode cardNode : cardsArray) {
                String title = cardNode.has("title") && !cardNode.get("title").isNull()
                        ? cardNode.get("title").asText() : null;
                String content = cardNode.has("content") && !cardNode.get("content").isNull()
                        ? cardNode.get("content").asText() : null;
                String sourcePlatform = cardNode.has("sourcePlatform") && !cardNode.get("sourcePlatform").isNull()
                        ? cardNode.get("sourcePlatform").asText() : "InfoDigest";

                // 跳过无效的卡片
                if (title == null || content == null) {
                    continue;
                }

                ReviewCard card = new ReviewCard();
                card.setUserId(userId);
                card.setTitle(title);
                card.setContent(content);
                card.setSourcePlatform(sourcePlatform);
                card.setScheduledReviewDate(today);
                card.setRepetitionCount(0);
                card.setEasinessFactor(2.5);
                card.setIntervalDays(0);
                card.setCreatedAt(LocalDateTime.now());

                reviewCardRepository.save(card);
                cardCount++;

                // 最多保存5张卡片
                if (cardCount >= 5) {
                    break;
                }
            }

            log.info("用户 {} 的复习卡片生成完成，共 {} 张", userId, cardCount);

        } catch (Exception e) {
            log.error("为用户 {} 生成复习卡片失败: {}", userId, e.getMessage(), e);
            throw new RuntimeException("生成复习卡片失败: " + e.getMessage());
        }
    }

    /**
     * 获取用户今日的复习卡片列表 (SM-2: 查找由于今天或之前未复习的卡片)
     */
    public List<Map<String, Object>> getTodayReviewCards(Long userId) {
        LocalDate today = LocalDate.now();
        List<ReviewCard> cards = reviewCardRepository.findByUserIdAndScheduledReviewDateLessThanEqualOrderByScheduledReviewDateAsc(userId, today);

        // Limit to 15 cards per session to avoid overwhelming the user
        List<ReviewCard> dueCards = cards.stream().limit(15).collect(Collectors.toList());

        List<Map<String, Object>> result = new ArrayList<>();

        if (!dueCards.isEmpty()) {
            for (ReviewCard card : dueCards) {
                Map<String, Object> cardMap = new LinkedHashMap<>();
                cardMap.put("id", card.getId()); // Needed for feedback API
                cardMap.put("title", card.getTitle());
                cardMap.put("content", card.getContent());
                cardMap.put("source", card.getSourcePlatform());
                result.add(cardMap);
            }
        } else {
            // 没有数据时返回默认内容
            Map<String, Object> defaultCard = new LinkedHashMap<>();
            defaultCard.put("id", -1);
            defaultCard.put("title", "近期没有需要复习的内容");
            defaultCard.put("content", "系统会根据你的学习情况智能推荐复习内容");
            defaultCard.put("source", "InfoDigest");
            result.add(defaultCard);
        }

        return result;
    }

    /**
     * 处理复习反馈 (SM-2 算法)
     */
    @Transactional
    public void processFeedback(Long cardId, Long userId, boolean remembered) {
        Optional<ReviewCard> optCard = reviewCardRepository.findById(cardId);
        if (optCard.isEmpty()) {
            throw new IllegalArgumentException("Card not found");
        }
        ReviewCard card = optCard.get();
        if (!card.getUserId().equals(userId)) {
            throw new SecurityException("Unauthorized access to this card");
        }

        int repetitionCount = card.getRepetitionCount() != null ? card.getRepetitionCount() : 0;
        double easinessFactor = card.getEasinessFactor() != null ? card.getEasinessFactor() : 2.5;
        int intervalDays = card.getIntervalDays() != null ? card.getIntervalDays() : 0;

        if (remembered) {
            if (repetitionCount == 0) {
                intervalDays = 1;
            } else if (repetitionCount == 1) {
                intervalDays = 6;
            } else {
                intervalDays = (int) Math.round(intervalDays * easinessFactor);
            }
            easinessFactor = Math.max(1.3, easinessFactor + 0.1);
            repetitionCount++;
        } else {
            repetitionCount = 0;
            intervalDays = 0;
            easinessFactor = Math.max(1.3, easinessFactor - 0.2);
        }

        card.setRepetitionCount(repetitionCount);
        card.setEasinessFactor(easinessFactor);
        card.setIntervalDays(intervalDays);
        card.setScheduledReviewDate(LocalDate.now().plusDays(intervalDays));
        
        reviewCardRepository.save(card);
    }
}
