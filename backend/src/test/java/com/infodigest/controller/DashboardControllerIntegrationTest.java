package com.infodigest.controller;

import com.infodigest.config.BaseIntegrationTest;
import com.infodigest.entity.InformationItem;
import com.infodigest.entity.UserWordCloud;
import com.infodigest.repository.InformationItemRepository;
import com.infodigest.repository.ReviewCardRepository;
import com.infodigest.repository.UserWordCloudRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.LocalDate;
import java.time.LocalDateTime;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class DashboardControllerIntegrationTest extends BaseIntegrationTest {

    @Autowired
    private InformationItemRepository informationItemRepository;

    @Autowired
    private UserWordCloudRepository userWordCloudRepository;

    @Autowired
    private ReviewCardRepository reviewCardRepository;

    private InformationItem createTestItem(Long userId, String title, String platform,
                                           String processStatus, LocalDateTime crawledAt,
                                           Integer durationMinutes, Integer protein,
                                           Integer carbs, Integer vitamins, Integer fats,
                                           Integer fiber) {
        InformationItem item = new InformationItem();
        item.setUserId(userId);
        item.setTitle(title);
        item.setPlatform(platform);
        item.setProcessStatus(processStatus);
        item.setCrawledAt(crawledAt);
        item.setDurationMinutes(durationMinutes);
        item.setNutritionProtein(protein);
        item.setNutritionCarbs(carbs);
        item.setNutritionVitamins(vitamins);
        item.setNutritionFats(fats);
        item.setNutritionFiber(fiber);
        return informationItemRepository.save(item);
    }

    @Override
    @BeforeEach
    public void setUpBase() throws Exception {
        super.setUpBase();
    }

    @Test
    void getNutrition_withTypeWeekly_returnsNutritionData() throws Exception {
        // Create items with nutrition data crawled this week
        createTestItem(testUserId, "Test Item 1", "BILIBILI", "PROCESSED",
                LocalDateTime.now().minusDays(1), 30, 40, 30, 20, 5, 5);
        createTestItem(testUserId, "Test Item 2", "ZHIHU", "PROCESSED",
                LocalDateTime.now(), 20, 50, 20, 15, 10, 5);

        mockMvc.perform(get("/api/dashboard/nutrition")
                        .param("type", "weekly")
                        .header("Authorization", "Bearer " + testToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hasData").value(true))
                .andExpect(jsonPath("$.data", hasSize(5)))
                .andExpect(jsonPath("$.totalHours").isNumber());
    }

    @Test
    void getNutrition_withTypeAll_returnsNutritionData() throws Exception {
        // Create today's PROCESSED items with nutrition data
        createTestItem(testUserId, "Today Item", "BILIBILI", "PROCESSED",
                LocalDateTime.now(), 10, 60, 20, 10, 5, 5);

        mockMvc.perform(get("/api/dashboard/nutrition")
                        .param("type", "all")
                        .header("Authorization", "Bearer " + testToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hasData").value(true))
                .andExpect(jsonPath("$.data", hasSize(5)))
                .andExpect(jsonPath("$.totalHours").isNumber());
    }

    @Test
    void getNutrition_withNoData_returnsHasDataFalse() throws Exception {
        mockMvc.perform(get("/api/dashboard/nutrition")
                        .param("type", "weekly")
                        .header("Authorization", "Bearer " + testToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hasData").value(false))
                .andExpect(jsonPath("$.data", hasSize(0)))
                .andExpect(jsonPath("$.totalHours").value(0.0));
    }

    @Test
    void getSummary_returnsSummaryStats() throws Exception {
        createTestItem(testUserId, "Summary Item 1", "BILIBILI", "PROCESSED",
                LocalDateTime.now(), 30, 40, 30, 20, 5, 5);
        createTestItem(testUserId, "Summary Item 2", "ZHIHU", "PROCESSED",
                LocalDateTime.now(), 20, 50, 20, 15, 10, 5);

        mockMvc.perform(get("/api/dashboard/summary")
                        .header("Authorization", "Bearer " + testToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.todayViews").isNumber())
                .andExpect(jsonPath("$.premiumCount").isNumber())
                .andExpect(jsonPath("$.immersionHours").isNumber());
    }

    @Test
    void getWordCloudHistory_returnsWordCloudData() throws Exception {
        // Create UserWordCloud entries for the current week
        UserWordCloud wc = new UserWordCloud();
        wc.setUserId(testUserId);
        wc.setReportDate(LocalDate.now());
        wc.setKeywords("[{\"word\":\"test\",\"value\":100}]");
        userWordCloudRepository.save(wc);

        mockMvc.perform(get("/api/dashboard/wordcloud/history")
                        .header("Authorization", "Bearer " + testToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }

    @Test
    void cleanupDuplicates_withDuplicateItems_removesDuplicates() throws Exception {
        // Create duplicate items (same URL + platform)
        createTestItem(testUserId, "Original", "BILIBILI", "PROCESSED",
                LocalDateTime.now().minusDays(2), 10, null, null, null, null, null);
        createTestItem(testUserId, "Duplicate", "BILIBILI", "PROCESSED",
                LocalDateTime.now().minusDays(1), 10, null, null, null, null, null);

        mockMvc.perform(post("/api/dashboard/cleanup-duplicates")
                        .header("Authorization", "Bearer " + testToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.deletedCount").isNumber())
                .andExpect(jsonPath("$.remainingCount").isNumber())
                .andExpect(jsonPath("$.message").isString());
    }

    @Test
    void getInsights_whenNoInsightsExist_returnsOkWithInsightList() throws Exception {
        mockMvc.perform(get("/api/dashboard/insights")
                        .header("Authorization", "Bearer " + testToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$.length()").value(1));
    }

    @Test
    void getTodayReviews_whenNoReviewsExist_returnsEmptyList() throws Exception {
        mockMvc.perform(get("/api/dashboard/reviews/today")
                        .header("Authorization", "Bearer " + testToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }

    @Test
    void getWordCloud_returnsWordCloudData() throws Exception {
        // Create UserWordCloud entry for today
        UserWordCloud wc = new UserWordCloud();
        wc.setUserId(testUserId);
        wc.setReportDate(LocalDate.now());
        wc.setKeywords("[{\"word\":\"test\",\"value\":100}]");
        userWordCloudRepository.save(wc);

        mockMvc.perform(get("/api/dashboard/wordcloud")
                        .header("Authorization", "Bearer " + testToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }

    @Test
    void getNutrition_withTypeDaily_returnsNutritionData() throws Exception {
        createTestItem(testUserId, "Daily Item 1", "BILIBILI", "PROCESSED",
                LocalDateTime.now(), 15, 50, 25, 15, 5, 5);

        mockMvc.perform(get("/api/dashboard/nutrition")
                        .param("type", "daily")
                        .header("Authorization", "Bearer " + testToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hasData").value(true))
                .andExpect(jsonPath("$.data", hasSize(5)));
    }

    @Test
    void cleanupTitleDuplicates_withDuplicateTitles_removesDuplicates() throws Exception {
        createTestItem(testUserId, "Same Title", "BILIBILI", "PROCESSED",
                LocalDateTime.now().minusDays(2), 10, null, null, null, null, null);
        createTestItem(testUserId, "Same Title", "BILIBILI", "PROCESSED",
                LocalDateTime.now().minusDays(1), 10, null, null, null, null, null);

        mockMvc.perform(post("/api/dashboard/cleanup-title-duplicates")
                        .header("Authorization", "Bearer " + testToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.deletedCount").isNumber());
    }
}
