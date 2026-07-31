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

class AnalysisControllerIntegrationTest extends BaseIntegrationTest {

    @Autowired
    private InformationItemRepository informationItemRepository;

    private Long itemId;

    @Override
    @BeforeEach
    public void setUpBase() throws Exception {
        super.setUpBase();

        // Create an InformationItem for testing
        InformationItem item = new InformationItem();
        item.setUserId(testUserId);
        item.setTitle("测试分析内容");
        item.setUrl("https://example.com/test");
        item.setPlatform("BILIBILI");
        item.setProcessStatus("UNPROCESSED");
        item = informationItemRepository.save(item);
        itemId = item.getId();
    }

    @Test
    void triggerAnalysis_shouldTriggerAnalysis() throws Exception {
        mockMvc.perform(post("/api/analysis/trigger/{itemId}", itemId)
                        .header("Authorization", "Bearer " + testToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("TRIGGERED"))
                .andExpect(jsonPath("$.message").value("分析任务已触发，请稍后查看结果"));
    }

    @Test
    void triggerAnalysis_forAlreadyProcessedItem_shouldReturnAlreadyProcessed() throws Exception {
        // Update item status to PROCESSED
        InformationItem item = informationItemRepository.findById(itemId).orElseThrow();
        item.setProcessStatus("PROCESSED");
        informationItemRepository.save(item);

        mockMvc.perform(post("/api/analysis/trigger/{itemId}", itemId)
                        .header("Authorization", "Bearer " + testToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ALREADY_PROCESSED"))
                .andExpect(jsonPath("$.message").value("该内容已经分析完成"));
    }

    @Test
    void triggerAnalysis_forNonExistentItem_shouldReturn400() throws Exception {
        mockMvc.perform(post("/api/analysis/trigger/{itemId}", 99999L)
                        .header("Authorization", "Bearer " + testToken))
                .andExpect(status().isBadRequest());
    }

    @Test
    void getAnalysisStatus_shouldReturnStatus() throws Exception {
        mockMvc.perform(get("/api/analysis/status/{itemId}", itemId)
                        .header("Authorization", "Bearer " + testToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.itemId").value(itemId))
                .andExpect(jsonPath("$.processStatus").value("UNPROCESSED"))
                .andExpect(jsonPath("$.title").value("测试分析内容"));
    }

    @Test
    void getAnalysisStatus_forNonExistentItem_shouldReturn400() throws Exception {
        mockMvc.perform(get("/api/analysis/status/{itemId}", 99999L)
                        .header("Authorization", "Bearer " + testToken))
                .andExpect(status().isBadRequest());
    }
}
