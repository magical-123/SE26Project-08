package com.infodigest.controller;

import com.infodigest.config.BaseIntegrationTest;
import com.infodigest.entity.InformationItem;
import com.infodigest.repository.InformationItemRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Tests insight-related endpoints in DashboardController:
 * GET  /api/dashboard/insights
 * POST /api/dashboard/insights/generate
 */
class InsightControllerIntegrationTest extends BaseIntegrationTest {

    @Autowired
    private InformationItemRepository informationItemRepository;

    @Override
    @BeforeEach
    public void setUpBase() throws Exception {
        super.setUpBase();

        // Create some processed InformationItems for insight generation
        InformationItem item1 = new InformationItem();
        item1.setUserId(testUserId);
        item1.setTitle("深入理解大模型架构");
        item1.setUrl("https://example.com/llm");
        item1.setPlatform("BILIBILI");
        item1.setProcessStatus("PROCESSED");
        item1.setAiSummary("本文深入探讨了 Transformer 架构和大模型的训练方法。");
        item1.setNutritionProtein(40);
        item1.setNutritionCarbs(30);
        item1.setNutritionVitamins(20);
        item1.setNutritionFats(5);
        item1.setNutritionFiber(5);
        informationItemRepository.save(item1);

        InformationItem item2 = new InformationItem();
        item2.setUserId(testUserId);
        item2.setTitle("React 19 性能优化实践");
        item2.setUrl("https://example.com/react-perf");
        item2.setPlatform("ZHIHU");
        item2.setProcessStatus("PROCESSED");
        item2.setAiSummary("React 19 的编译器和并发特性大幅提升了应用性能。");
        item2.setNutritionProtein(25);
        item2.setNutritionCarbs(45);
        item2.setNutritionVitamins(15);
        item2.setNutritionFats(10);
        item2.setNutritionFiber(5);
        informationItemRepository.save(item2);
    }

    @Test
    void getInsights_shouldReturnDashboardInsights() throws Exception {
        mockMvc.perform(get("/api/dashboard/insights")
                        .header("Authorization", "Bearer " + testToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }

    @Test
    void generateInsight_shouldGenerateSuccessfully() throws Exception {
        mockMvc.perform(post("/api/dashboard/insights/generate")
                        .header("Authorization", "Bearer " + testToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("洞察生成成功"));
    }

    @Test
    void getInsights_shouldReturnDataArray() throws Exception {
        mockMvc.perform(get("/api/dashboard/insights")
                        .header("Authorization", "Bearer " + testToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }
}
