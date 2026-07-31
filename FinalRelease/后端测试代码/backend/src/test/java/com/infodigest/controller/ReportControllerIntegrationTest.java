package com.infodigest.controller;

import com.infodigest.config.BaseIntegrationTest;
import org.junit.jupiter.api.Test;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class ReportControllerIntegrationTest extends BaseIntegrationTest {

    @Test
    void getDailyInsight_ReturnsReport() throws Exception {
        mockMvc.perform(get("/api/report/insight")
                        .param("type", "daily")
                        .header("Authorization", "Bearer " + testToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hasReport").value(false));
    }

    @Test
    void getWeeklyInsight_ReturnsReport() throws Exception {
        mockMvc.perform(get("/api/report/insight")
                        .param("type", "weekly")
                        .header("Authorization", "Bearer " + testToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hasReport").value(false));
    }

    @Test
    void getSummary_ReturnsSummary() throws Exception {
        mockMvc.perform(get("/api/report/summary")
                        .header("Authorization", "Bearer " + testToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalHours").isNumber())
                .andExpect(jsonPath("$.topTopic").isString())
                .andExpect(jsonPath("$.efficiency").isNumber())
                .andExpect(jsonPath("$.itemCount").isNumber());
    }
}
