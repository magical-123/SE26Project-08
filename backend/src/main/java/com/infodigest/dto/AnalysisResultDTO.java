package com.infodigest.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AnalysisResultDTO {
    private Integer protein;      // 蛋白质：深度认知与硬核知识
    private Integer carbs;        // 碳水化合物：实用技能与行业快讯
    private Integer vitamins;     // 维生素：创意灵感与美学体验
    private Integer fats;         // 脂肪与糖分：纯娱乐与情绪多巴胺
    private Integer fiber;        // 膳食纤维：哲思与心理复原力
    private String reasoning;     // 营养成分分析理由
    private String summary;       // 内容摘要

    // 可选：AI 从内容中提取的金句
    private List<QuoteItem> quotes;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class QuoteItem {
        private String text;      // 金句原文
        private String reason;    // 为什么是金句
    }
}
