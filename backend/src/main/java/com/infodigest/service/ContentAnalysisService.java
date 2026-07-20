package com.infodigest.service;

import com.infodigest.dto.AnalysisResultDTO;
import com.infodigest.entity.AIConfig;
import com.infodigest.entity.InformationItem;
import com.infodigest.repository.AIConfigRepository;
import com.infodigest.repository.InformationItemRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@Slf4j
public class ContentAnalysisService {

    @Autowired
    private InformationItemRepository itemRepository;

    @Autowired
    private AIConfigRepository configRepository;

    @Autowired
    private AIService aiService;

    private static final int MAX_CONTENT_LENGTH = 4000;

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

        请返回 JSON 格式（注意：百分比用整数表示，不要带%符号）：
        {
          "protein": 50,
          "carbs": 30,
          "vitamins": 5,
          "fats": 5,
          "fiber": 10,
          "reasoning": "该视频以深度技术讲解为主（蛋白质50%），同时包含大量实用代码示例（碳水30%），有一定思维启发（纤维10%），设计审美和娱乐成分较少（各5%）",
          "summary": "本视频系统讲解微服务架构设计..."
        }

        请确保 protein + carbs + vitamins + fats + fiber = 100
        """;

    @Transactional
    public void analyzeItem(Long itemId) throws Exception {
        InformationItem item = itemRepository.findById(itemId)
                .orElseThrow(() -> new RuntimeException("Item not found: " + itemId));

        if ("PROCESSED".equals(item.getProcessStatus())) {
            log.info("Item {} already processed, skipping", itemId);
            return;
        }

        AIConfig config = configRepository.findByUserId(item.getUserId())
                .orElseThrow(() -> new RuntimeException("AI config not found for user: " + item.getUserId()));

        String userPrompt = buildContentPrompt(item, SYSTEM_PROMPT);

        log.info("Starting analysis for item {}", itemId);

        try {
            AnalysisResultDTO result = aiService.analyze(config, "", userPrompt);

            // 使用局部更新，仅更新 AI 分析相关字段，避免覆盖用户手动标记的 isPremium 等字段
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

            log.info("Analysis completed for item {}: protein={}, carbs={}, vitamins={}, fats={}, fiber={}",
                    itemId, result.getProtein(), result.getCarbs(), result.getVitamins(),
                    result.getFats(), result.getFiber());

        } catch (Exception e) {
            log.error("Analysis failed for item {}: {}", itemId, e.getMessage(), e);
            // 失败时也只更新 processStatus，不影响其他字段
            itemRepository.updateProcessStatus(itemId, "FAILED");
            throw e;
        }
    }

    private String buildContentPrompt(InformationItem item, String template) {
        String content = item.getContentRaw();
        if (content != null && content.length() > MAX_CONTENT_LENGTH) {
            content = truncateContent(content, MAX_CONTENT_LENGTH);
        }

        return template
                .replace("{title}", item.getTitle() != null ? item.getTitle() : "")
                .replace("{platform}", item.getPlatform() != null ? item.getPlatform() : "")
                .replace("{duration}", item.getDurationMinutes() != null ? String.valueOf(item.getDurationMinutes()) : "未知")
                .replace("{content}", content != null ? content : "");
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
}
