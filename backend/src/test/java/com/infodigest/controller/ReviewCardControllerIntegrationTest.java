package com.infodigest.controller;

import com.infodigest.config.BaseIntegrationTest;
import com.infodigest.entity.InformationItem;
import com.infodigest.entity.ReviewCard;
import com.infodigest.repository.InformationItemRepository;
import com.infodigest.repository.ReviewCardRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.LocalDate;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Tests review-related endpoints in DashboardController:
 * GET  /api/dashboard/reviews/today
 * POST /api/dashboard/reviews/generate
 */
class ReviewCardControllerIntegrationTest extends BaseIntegrationTest {

    @Autowired
    private ReviewCardRepository reviewCardRepository;

    @Autowired
    private InformationItemRepository informationItemRepository;

    @Override
    @BeforeEach
    public void setUpBase() throws Exception {
        super.setUpBase();

        // Create some InformationItems to support review card generation
        InformationItem item1 = new InformationItem();
        item1.setUserId(testUserId);
        item1.setTitle("React 19 新特性解析");
        item1.setUrl("https://example.com/react19");
        item1.setPlatform("BILIBILI");
        item1.setProcessStatus("PROCESSED");
        item1.setAiSummary("React 19 引入了很多新特性，包括 Server Components 和 Actions。");
        informationItemRepository.save(item1);

        InformationItem item2 = new InformationItem();
        item2.setUserId(testUserId);
        item2.setTitle("TypeScript 5.0 新功能");
        item2.setUrl("https://example.com/ts5");
        item2.setPlatform("ZHIHU");
        item2.setProcessStatus("PROCESSED");
        item2.setAiSummary("TypeScript 5.0 引入了装饰器、const 类型参数等新功能。");
        informationItemRepository.save(item2);
    }

    @Test
    void getTodayReviews_shouldReturnReviewCards() throws Exception {
        // Create a ReviewCard for today
        ReviewCard card = new ReviewCard();
        card.setUserId(testUserId);
        card.setTitle("什么是 React Server Components?");
        card.setContent("Server Components 是在服务端渲染的 React 组件...");
        card.setSourcePlatform("BILIBILI");
        card.setScheduledReviewDate(LocalDate.now());
        reviewCardRepository.save(card);

        mockMvc.perform(get("/api/dashboard/reviews/today")
                        .header("Authorization", "Bearer " + testToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }

    @Test
    void generateReviewCard_shouldGenerateSuccessfully() throws Exception {
        mockMvc.perform(post("/api/dashboard/reviews/generate")
                        .header("Authorization", "Bearer " + testToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("复习卡片生成成功"));
    }

    @Test
    void getTodayReviews_shouldReturnExistingCards() throws Exception {
        // Create multiple ReviewCards for today
        ReviewCard card1 = new ReviewCard();
        card1.setUserId(testUserId);
        card1.setTitle("卡片1");
        card1.setContent("内容1");
        card1.setScheduledReviewDate(LocalDate.now());
        reviewCardRepository.save(card1);

        ReviewCard card2 = new ReviewCard();
        card2.setUserId(testUserId);
        card2.setTitle("卡片2");
        card2.setContent("内容2");
        card2.setScheduledReviewDate(LocalDate.now());
        reviewCardRepository.save(card2);

        mockMvc.perform(get("/api/dashboard/reviews/today")
                        .header("Authorization", "Bearer " + testToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }

    @Test
    void generateAndGetTodayReviews_shouldWork() throws Exception {
        // Generate cards first
        mockMvc.perform(post("/api/dashboard/reviews/generate")
                        .header("Authorization", "Bearer " + testToken))
                .andExpect(status().isOk());

        // Then fetch today's reviews - should succeed
        mockMvc.perform(get("/api/dashboard/reviews/today")
                        .header("Authorization", "Bearer " + testToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }
}
