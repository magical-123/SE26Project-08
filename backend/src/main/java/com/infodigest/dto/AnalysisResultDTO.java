package com.infodigest.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

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
}
