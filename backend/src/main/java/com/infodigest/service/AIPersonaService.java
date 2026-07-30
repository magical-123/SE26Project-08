package com.infodigest.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.infodigest.entity.InformationItem;
import com.infodigest.entity.UserTopicCluster;
import com.infodigest.repository.InformationItemRepository;
import com.infodigest.repository.UserTopicClusterRepository;
import lombok.extern.slf4j.Slf4j;
import org.redisson.api.RBucket;
import org.redisson.api.RedissonClient;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Service
@Slf4j
public class AIPersonaService {

    @Autowired
    private InformationItemRepository informationItemRepository;

    @Autowired
    private UserTopicClusterRepository topicClusterRepository;

    @Autowired
    private AIService aiService;

    @Autowired
    private ObjectMapper objectMapper;

    private static final String PERSONA_PROMPT = """
            你是一位极其敏锐的心理学家与知识架构师。你的任务是基于用户近期深度消费的高质量内容，以及他们自己留下的思考笔记，为他绘制一幅“灵魂画像”。

            【全局底色标签】
            %s

            【近期优质内容切片】
            %s

            【任务要求】
            请深入阅读这些信息源，特别是用户的个人笔记。不要做简单的文本摘要，而是去进行深度的心智推理：
            - 用户的笔记透露出怎样的思维习惯？是严谨的提炼，还是天马行空的灵感发散？
            - 他在借由这些知识，试图解决内心的什么困惑，或是构建怎样的认知体系？
            - 结合长文稿内容，他最关注的知识锚点在哪里？

            请用极具洞察力、共情力和文学美感的语言，以第二人称（你）写一段分析。并严格按照以下 JSON 格式返回：
            {
              "personaTitle": "（4-8个字，极具张力的称号，如：系统边界的探索者）",
              "poeticSummary": "（一句富有诗意的总结）",
              "coreTraits": ["#硬核求知", "#系统性思维", "#人文关怀"],
              "deepInsight": "（约200字的深度分析，必须高度结合传入的【用户个人笔记】和【全文字幕细节】，向他揭示你观察到的他独特的思考路径与求知气质）",
              "goldenQuote": "（从传入的长文稿中，严格摘录出原话中最能呼应他个人笔记、最能代表他当前心境的一句名言，必须是原文原话！）"
            }
            """;

    @Autowired
    private RedissonClient redissonClient;

    public Map<String, Object> generatePersona(Long userId, boolean forceRefresh) {
        log.info("Generating AI Persona for user {}, forceRefresh: {}", userId, forceRefresh);
        
        String cacheKey = "persona:" + userId;
        RBucket<String> bucket = redissonClient.getBucket(cacheKey);
        
        if (!forceRefresh && bucket.isExists()) {
            log.info("Returning cached persona for user {}", userId);
            try {
                return objectMapper.readValue(bucket.get(), new TypeReference<Map<String, Object>>() {});
            } catch (JsonProcessingException e) {
                log.warn("Failed to parse cached persona, regenerating...");
            }
        }

        // 1. 获取全局底色标签
        List<UserTopicCluster> reports = topicClusterRepository.findByUserIdOrderByReportDateDesc(userId);
        String tags = "暂无标签";
        if (!reports.isEmpty()) {
            try {
                String clustersJson = reports.get(0).getClusters();
                if (clustersJson != null && !clustersJson.isBlank()) {
                    List<Map<String, Object>> clusterList = objectMapper.readValue(clustersJson, new TypeReference<List<Map<String, Object>>>() {});
                    String parsedTags = clusterList.stream()
                            .map(m -> m.get("name") + "(" + m.get("count") + ")")
                            .collect(Collectors.joining(", "));
                    if (!parsedTags.isEmpty()) {
                        tags = parsedTags;
                    }
                }
            } catch (Exception e) {
                log.warn("解析 clusters JSON 失败: {}", e.getMessage());
            }
        }

        // 2. 获取近期最多10条优质信息源
        List<InformationItem> premiumItems = informationItemRepository.findTop10ByUserIdAndIsPremiumTrueOrderByCrawledAtDesc(userId);
        if (premiumItems.isEmpty()) {
            throw new RuntimeException("无足够的优质信息源来生成画像，请先收藏或点赞一些内容。");
        }

        StringBuilder itemsText = new StringBuilder();
        for (int i = 0; i < premiumItems.size(); i++) {
            InformationItem item = premiumItems.get(i);
            itemsText.append(String.format("内容 %d:\\n", i + 1));
            itemsText.append("标题: ").append(item.getTitle()).append("\\n");
            
            String content = item.getContentRaw() != null ? item.getContentRaw() : (item.getAiSummary() != null ? item.getAiSummary() : "无文稿");
            // 截断一下避免极端情况超出超大文本，虽然Gemini窗口大，但稍微约束一下
            if (content.length() > 20000) {
                content = content.substring(0, 20000) + "...(截断)";
            }
            itemsText.append("文稿/字幕: ").append(content).append("\\n");

            if (item.getUserNote() != null && !item.getUserNote().trim().isEmpty()) {
                itemsText.append("【用户个人笔记】: ").append(item.getUserNote()).append("\\n");
            }
            itemsText.append("\\n---\\n");
        }

        // 3. 构建 Prompt
        String prompt = String.format(PERSONA_PROMPT, tags, itemsText.toString());

        // 4. 调用大模型
        try {
            String jsonResponse = aiService.generateInsight(prompt, userId);
            // aiService 的输出可能会带 markdown 代码块
            if (jsonResponse.startsWith("```json")) {
                jsonResponse = jsonResponse.substring(7);
                if (jsonResponse.endsWith("```")) {
                    jsonResponse = jsonResponse.substring(0, jsonResponse.length() - 3);
                }
            } else if (jsonResponse.startsWith("```")) {
                jsonResponse = jsonResponse.substring(3);
                if (jsonResponse.endsWith("```")) {
                    jsonResponse = jsonResponse.substring(0, jsonResponse.length() - 3);
                }
            }
            Map<String, Object> persona = objectMapper.readValue(jsonResponse, new TypeReference<Map<String, Object>>() {});
            
            // 写入缓存，24小时过期
            bucket.set(objectMapper.writeValueAsString(persona), 24, TimeUnit.HOURS);
            
            return persona;
        } catch (JsonProcessingException e) {
            log.error("解析 AI Persona JSON 失败: {}", e.getMessage());
            throw new RuntimeException("生成画像失败，AI 返回格式异常");
        } catch (Exception e) {
            log.error("生成 AI Persona 失败: {}", e.getMessage());
            throw new RuntimeException("生成画像失败: " + e.getMessage());
        }
    }
}
