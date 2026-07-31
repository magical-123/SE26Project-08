package com.infodigest.controller;

import com.infodigest.config.BaseIntegrationTest;
import com.infodigest.entity.InformationItem;
import com.infodigest.repository.InformationItemRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.redisson.api.RBlockingDeque;
import org.redisson.api.RFuture;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.LocalDateTime;

import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class InboxControllerIntegrationTest extends BaseIntegrationTest {

    @Autowired
    private InformationItemRepository informationItemRepository;

    @Autowired
    private RBlockingDeque<Long> analysisQueue;

    @Override
    @BeforeEach
    public void setUpBase() throws Exception {
        super.setUpBase();

        // Stub analysisQueue.offerAsync() to avoid NPE when InboxController pushes items to the queue
        when(analysisQueue.offerAsync(anyLong())).thenReturn(org.mockito.Mockito.mock(RFuture.class));
    }

    private InformationItem createTestItem(Long userId, String title, String platform, String processStatus) {
        InformationItem item = new InformationItem();
        item.setUserId(userId);
        item.setTitle(title);
        item.setPlatform(platform);
        item.setProcessStatus(processStatus);
        item.setCrawledAt(LocalDateTime.now());
        return informationItemRepository.save(item);
    }

    @SuppressWarnings("unchecked")
    @Test
    void getInboxItems_withPageZero_returnsPaginatedItems() throws Exception {
        createTestItem(testUserId, "Item 1", "BILIBILI", "UNPROCESSED");
        createTestItem(testUserId, "Item 2", "ZHIHU", "UNPROCESSED");

        mockMvc.perform(get("/api/inbox/items")
                        .param("page", "0")
                        .header("Authorization", "Bearer " + testToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isArray())
                .andExpect(jsonPath("$.totalItems").isNumber())
                .andExpect(jsonPath("$.totalPages").isNumber())
                .andExpect(jsonPath("$.currentPage").value(0))
                .andExpect(jsonPath("$.hasMore").isBoolean())
                .andExpect(jsonPath("$.premiumCount").isNumber())
                .andExpect(jsonPath("$.aiSummaryCount").isNumber());
    }

    @Test
    void createInboxItem_createsNewItem() throws Exception {
        String requestBody = """
                {
                    "title": "Test New Item",
                    "platform": "BILIBILI",
                    "url": "https://bilibili.com/video/test123",
                    "durationMinutes": 15
                }
                """;

        mockMvc.perform(post("/api/inbox/items")
                        .header("Authorization", "Bearer " + testToken)
                        .contentType("application/json")
                        .content(requestBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Test New Item"))
                .andExpect(jsonPath("$.platform").value("BILIBILI"))
                .andExpect(jsonPath("$.userId").value(testUserId));
    }

    @Test
    void updateInboxItem_togglePremium() throws Exception {
        // First create an item
        InformationItem saved = createTestItem(testUserId, "Toggle Premium Item", "BILIBILI", "UNPROCESSED");

        // Then toggle premium
        String updateBody = """
                {
                    "isPremium": true
                }
                """;

        mockMvc.perform(put("/api/inbox/items/{id}", saved.getId())
                        .header("Authorization", "Bearer " + testToken)
                        .contentType("application/json")
                        .content(updateBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isPremium").value(true));
    }

    @Test
    void getInboxItems_filterByPlatform_returnsFilteredResults() throws Exception {
        createTestItem(testUserId, "B站视频", "BILIBILI", "UNPROCESSED");
        createTestItem(testUserId, "知乎文章", "ZHIHU", "UNPROCESSED");
        createTestItem(testUserId, "GitHub Repo", "GITHUB", "UNPROCESSED");

        mockMvc.perform(get("/api/inbox/items")
                        .param("page", "0")
                        .param("platform", "BILIBILI")
                        .header("Authorization", "Bearer " + testToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isArray())
                .andExpect(jsonPath("$.totalItems").isNumber());
    }

    @Test
    void createInboxItem_manualItemWithNote() throws Exception {
        String requestBody = """
                {
                    "title": "Manual Note Item",
                    "platform": "ZHIHU",
                    "url": "https://zhihu.com/question/test",
                    "userNote": "This is a personal note",
                    "durationMinutes": 10
                }
                """;

        mockMvc.perform(post("/api/inbox/items")
                        .header("Authorization", "Bearer " + testToken)
                        .contentType("application/json")
                        .content(requestBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Manual Note Item"))
                .andExpect(jsonPath("$.platform").value("ZHIHU"));
    }

    @Test
    void reanalyzeItem_regeneratesSummary() throws Exception {
        InformationItem saved = createTestItem(testUserId, "Reanalyze Me", "BILIBILI", "PROCESSED");

        mockMvc.perform(post("/api/inbox/items/{id}/regenerate-summary", saved.getId())
                        .header("Authorization", "Bearer " + testToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.itemId").value(saved.getId()))
                .andExpect(jsonPath("$.message").isString());
    }

    @Test
    void getInboxItem_returnsSingleItem() throws Exception {
        InformationItem saved = createTestItem(testUserId, "Single Item", "BILIBILI", "PROCESSED");

        mockMvc.perform(get("/api/inbox/items/{id}", saved.getId())
                        .header("Authorization", "Bearer " + testToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Single Item"))
                .andExpect(jsonPath("$.platform").value("BILIBILI"));
    }

    @Test
    void getInboxItem_withUnknownId_returnsNotFound() throws Exception {
        mockMvc.perform(get("/api/inbox/items/{id}", 99999L)
                        .header("Authorization", "Bearer " + testToken))
                .andExpect(status().isNotFound());
    }

    @Test
    void toggleLike_togglesLikeStatus() throws Exception {
        InformationItem saved = createTestItem(testUserId, "Like Test", "BILIBILI", "UNPROCESSED");

        // Toggle like on
        mockMvc.perform(post("/api/inbox/items/{id}/like", saved.getId())
                        .header("Authorization", "Bearer " + testToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isLiked").value(true));

        // Toggle like off
        mockMvc.perform(post("/api/inbox/items/{id}/like", saved.getId())
                        .header("Authorization", "Bearer " + testToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isLiked").value(false));
    }

    @Test
    void deleteInboxItem_deletesItem() throws Exception {
        InformationItem saved = createTestItem(testUserId, "Delete Me", "BILIBILI", "UNPROCESSED");

        mockMvc.perform(delete("/api/inbox/items/{id}", saved.getId())
                        .header("Authorization", "Bearer " + testToken))
                .andExpect(status().isNoContent());

        // Verify it's gone
        mockMvc.perform(get("/api/inbox/items/{id}", saved.getId())
                        .header("Authorization", "Bearer " + testToken))
                .andExpect(status().isNotFound());
    }

    @Test
    void createInboxItem_withInvalidTitle_returnsBadRequest() throws Exception {
        String requestBody = """
                {
                    "title": "",
                    "platform": "BILIBILI",
                    "url": "https://bilibili.com/video/invalid"
                }
                """;

        mockMvc.perform(post("/api/inbox/items")
                        .header("Authorization", "Bearer " + testToken)
                        .contentType("application/json")
                        .content(requestBody))
                .andExpect(status().isBadRequest());
    }

    @Test
    void toggleFavorite_togglesFavoriteStatus() throws Exception {
        InformationItem saved = createTestItem(testUserId, "Favorite Test", "BILIBILI", "UNPROCESSED");

        // Toggle favorite on
        mockMvc.perform(post("/api/inbox/items/{id}/favorite", saved.getId())
                        .header("Authorization", "Bearer " + testToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isFavorite").value(true));

        // Toggle favorite off
        mockMvc.perform(post("/api/inbox/items/{id}/favorite", saved.getId())
                        .header("Authorization", "Bearer " + testToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isFavorite").value(false));
    }
}
