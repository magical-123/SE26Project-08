package com.infodigest.controller;

import com.infodigest.config.BaseIntegrationTest;
import org.junit.jupiter.api.Test;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class WordCloudControllerIntegrationTest extends BaseIntegrationTest {

    @Test
    void getDailyWordCloud_ReturnsNoDataWhenNoWordCloudExists() throws Exception {
        mockMvc.perform(get("/api/wordcloud/daily")
                        .param("userId", testUserId.toString())
                        .header("Authorization", "Bearer " + testToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.hasData").value(false));
    }

    @Test
    void generateWordCloud_ReturnsErrorWhenNoData() throws Exception {
        mockMvc.perform(post("/api/wordcloud/generate")
                        .param("userId", testUserId.toString())
                        .header("Authorization", "Bearer " + testToken))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error").isString());
    }
}
