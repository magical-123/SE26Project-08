package com.infodigest.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.infodigest.entity.InformationItem;
import com.infodigest.entity.ReviewCard;
import com.infodigest.repository.InformationItemRepository;
import com.infodigest.repository.ReviewCardRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ReviewCardGenerationServiceTest {

    @Mock
    private InformationItemRepository informationItemRepository;

    @Mock
    private ReviewCardRepository reviewCardRepository;

    @Mock
    private AIService aiService;

    @InjectMocks
    private ReviewCardGenerationService reviewCardGenerationService;

    @Captor
    private ArgumentCaptor<ReviewCard> reviewCardCaptor;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        // No special setup needed
    }

    private InformationItem createItem(Long id, String title, String platform, Integer protein, Integer carbs) {
        InformationItem item = new InformationItem();
        item.setId(id);
        item.setUserId(1L);
        item.setTitle(title);
        item.setPlatform(platform);
        item.setAiSummary("测试摘要内容 " + title);
        item.setNutritionProtein(protein);
        item.setNutritionCarbs(carbs);
        item.setNutritionVitamins(10);
        item.setNutritionFats(10);
        item.setNutritionFiber(10);
        item.setAnalyzedAt(LocalDateTime.now());
        return item;
    }

    @Test
    void generateTodayReviewCard_createsReviewCard() throws Exception {
        // Given
        Long userId = 1L;

        InformationItem item1 = createItem(1L, "微服务架构设计", "BILIBILI", 60, 20);
        InformationItem item2 = createItem(2L, "AI入门教程", "ZHIHU", 40, 30);

        when(informationItemRepository.findByUserIdAndProcessStatusAndAnalyzedAtAfter(
                eq(userId), eq("PROCESSED"), any(LocalDateTime.class)))
                .thenReturn(List.of(item1, item2));

        String aiResponse = "{\"cards\":[{\"title\":\"什么是微服务\",\"content\":\"微服务是一种架构风格\",\"sourcePlatform\":\"BILIBILI\"}]}";
        when(aiService.generateInsight(anyString(), eq(userId))).thenReturn(aiResponse);

        when(reviewCardRepository.save(any(ReviewCard.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        // When
        reviewCardGenerationService.generateTodayReviewCard(userId);

        // Then
        verify(reviewCardRepository).save(reviewCardCaptor.capture());
        ReviewCard saved = reviewCardCaptor.getValue();
        assertThat(saved.getUserId()).isEqualTo(userId);
        assertThat(saved.getTitle()).isEqualTo("什么是微服务");
        assertThat(saved.getContent()).isEqualTo("微服务是一种架构风格");
        assertThat(saved.getSourcePlatform()).isEqualTo("BILIBILI");
        assertThat(saved.getScheduledReviewDate()).isEqualTo(LocalDate.now());
        assertThat(saved.getRepetitionCount()).isEqualTo(0);
        assertThat(saved.getEasinessFactor()).isEqualTo(2.5);
    }

    @Test
    void generateTodayReviewCard_handlesNoItemsToReview() throws Exception {
        // Given
        Long userId = 1L;

        lenient().when(informationItemRepository.findByUserIdAndProcessStatusAndAnalyzedAtAfter(
                eq(userId), eq("PROCESSED"), any(LocalDateTime.class)))
                .thenReturn(List.of());

        // When
        reviewCardGenerationService.generateTodayReviewCard(userId);

        // Then - should return silently without calling AI or saving
        verify(aiService, never()).generateInsight(anyString(), anyLong());
        verify(reviewCardRepository, never()).save(any());
    }

    @Test
    void generateTodayReviewCard_handlesDuplicateGeneration_idempotent() throws Exception {
        // Given
        Long userId = 1L;

        InformationItem item = createItem(1L, "微服务架构设计", "BILIBILI", 60, 20);

        when(informationItemRepository.findByUserIdAndProcessStatusAndAnalyzedAtAfter(
                eq(userId), eq("PROCESSED"), any(LocalDateTime.class)))
                .thenReturn(List.of(item));

        String aiResponse = "{\"cards\":[{\"title\":\"什么是微服务\",\"content\":\"微服务是一种架构风格\",\"sourcePlatform\":\"BILIBILI\"}]}";
        when(aiService.generateInsight(anyString(), eq(userId))).thenReturn(aiResponse);

        when(reviewCardRepository.save(any(ReviewCard.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        // When - call twice
        reviewCardGenerationService.generateTodayReviewCard(userId);
        reviewCardGenerationService.generateTodayReviewCard(userId);

        // Then - should save exactly 2 cards (one per call, no failure)
        verify(reviewCardRepository, times(2)).save(any(ReviewCard.class));
    }

    @Test
    void generateTodayReviewCard_createsMultipleCards() throws Exception {
        // Given
        Long userId = 1L;

        InformationItem item1 = createItem(1L, "微服务架构设计", "BILIBILI", 80, 10);
        InformationItem item2 = createItem(2L, "AI入门教程", "ZHIHU", 20, 70);
        InformationItem item3 = createItem(3L, "网络协议基础", "GITHUB", 50, 30);

        when(informationItemRepository.findByUserIdAndProcessStatusAndAnalyzedAtAfter(
                eq(userId), eq("PROCESSED"), any(LocalDateTime.class)))
                .thenReturn(List.of(item1, item2, item3));

        String aiResponse = "{\"cards\":["
                + "{\"title\":\"什么是微服务\",\"content\":\"微服务是一种架构风格\",\"sourcePlatform\":\"BILIBILI\"},"
                + "{\"title\":\"AI基础概念\",\"content\":\"人工智能的基本定义\",\"sourcePlatform\":\"ZHIHU\"}"
                + "]}";
        when(aiService.generateInsight(anyString(), eq(userId))).thenReturn(aiResponse);

        when(reviewCardRepository.save(any(ReviewCard.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        // When
        reviewCardGenerationService.generateTodayReviewCard(userId);

        // Then
        verify(reviewCardRepository, times(2)).save(reviewCardCaptor.capture());
        List<ReviewCard> allSaved = reviewCardCaptor.getAllValues();
        assertThat(allSaved).hasSize(2);
        assertThat(allSaved.get(0).getTitle()).isEqualTo("什么是微服务");
        assertThat(allSaved.get(1).getTitle()).isEqualTo("AI基础概念");
    }

    @Test
    void getTodayReviewCards_returnsDueCards() {
        // Given
        Long userId = 1L;
        ReviewCard card = new ReviewCard();
        card.setId(1L);
        card.setUserId(userId);
        card.setTitle("测试卡片");
        card.setContent("测试内容");
        card.setSourcePlatform("BILIBILI");

        when(reviewCardRepository.findByUserIdAndScheduledReviewDateLessThanEqualOrderByScheduledReviewDateAsc(
                eq(userId), any(LocalDate.class)))
                .thenReturn(List.of(card));

        // When
        List<Map<String, Object>> result = reviewCardGenerationService.getTodayReviewCards(userId);

        // Then
        assertThat(result).hasSize(1);
        assertThat(result.get(0).get("title")).isEqualTo("测试卡片");
        assertThat(result.get(0).get("content")).isEqualTo("测试内容");
        assertThat(result.get(0).get("source")).isEqualTo("BILIBILI");
    }

    @Test
    void getTodayReviewCards_returnsDefaultCard_whenNoneDue() {
        // Given
        Long userId = 1L;

        when(reviewCardRepository.findByUserIdAndScheduledReviewDateLessThanEqualOrderByScheduledReviewDateAsc(
                eq(userId), any(LocalDate.class)))
                .thenReturn(List.of());

        // When
        List<Map<String, Object>> result = reviewCardGenerationService.getTodayReviewCards(userId);

        // Then
        assertThat(result).hasSize(1);
        assertThat(result.get(0).get("id")).isEqualTo(-1);
        assertThat(result.get(0).get("title")).isEqualTo("近期没有需要复习的内容");
    }

    @Test
    void getTodayReviewCards_limitsToFifteenCards() {
        // Given
        Long userId = 1L;
        List<ReviewCard> manyCards = new java.util.ArrayList<>();
        for (int i = 0; i < 20; i++) {
            ReviewCard card = new ReviewCard();
            card.setId((long) i);
            card.setUserId(userId);
            card.setTitle("卡片" + i);
            card.setContent("内容" + i);
            card.setSourcePlatform("InfoDigest");
            manyCards.add(card);
        }

        when(reviewCardRepository.findByUserIdAndScheduledReviewDateLessThanEqualOrderByScheduledReviewDateAsc(
                eq(userId), any(LocalDate.class)))
                .thenReturn(manyCards);

        // When
        List<Map<String, Object>> result = reviewCardGenerationService.getTodayReviewCards(userId);

        // Then
        assertThat(result).hasSize(15);
    }

    @Test
    void generateTodayReviewCard_fallsBackToFourDays() throws Exception {
        // Given
        Long userId = 1L;

        InformationItem item = createItem(1L, "四天前的视频", "BILIBILI", 60, 20);

        // 2-day returns empty → triggers 4-day fallback
        when(informationItemRepository.findByUserIdAndProcessStatusAndAnalyzedAtAfter(
                eq(userId), eq("PROCESSED"), any(LocalDateTime.class)))
                .thenReturn(List.of(), List.of(item));

        String aiResponse = "{\"cards\":[{\"title\":\"回退测试\",\"content\":\"四天前的内容\",\"sourcePlatform\":\"BILIBILI\"}]}";
        when(aiService.generateInsight(anyString(), eq(userId))).thenReturn(aiResponse);

        when(reviewCardRepository.save(any(ReviewCard.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        // When
        reviewCardGenerationService.generateTodayReviewCard(userId);

        // Then
        verify(reviewCardRepository).save(reviewCardCaptor.capture());
        assertThat(reviewCardCaptor.getValue().getTitle()).isEqualTo("回退测试");
    }

    @Test
    void generateTodayReviewCard_filtersLowValueItems() throws Exception {
        // Given
        Long userId = 1L;

        // protein=10, carbs=20 — both < 30, so filter returns empty → uses all items
        InformationItem item = createItem(1L, "低价值内容", "ZHIHU", 10, 20);

        when(informationItemRepository.findByUserIdAndProcessStatusAndAnalyzedAtAfter(
                eq(userId), eq("PROCESSED"), any(LocalDateTime.class)))
                .thenReturn(List.of(item));

        String aiResponse = "{\"cards\":[{\"title\":\"低价值测试\",\"content\":\"仍然生成卡片\",\"sourcePlatform\":\"ZHIHU\"}]}";
        when(aiService.generateInsight(anyString(), eq(userId))).thenReturn(aiResponse);

        when(reviewCardRepository.save(any(ReviewCard.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        // When
        reviewCardGenerationService.generateTodayReviewCard(userId);

        // Then
        verify(reviewCardRepository).save(reviewCardCaptor.capture());
        assertThat(reviewCardCaptor.getValue().getTitle()).isEqualTo("低价值测试");
    }

    @Test
    void generateTodayReviewCard_handlesEmptyCardsResponse() throws Exception {
        // Given
        Long userId = 1L;

        InformationItem item = createItem(1L, "测试", "BILIBILI", 60, 20);

        when(informationItemRepository.findByUserIdAndProcessStatusAndAnalyzedAtAfter(
                eq(userId), eq("PROCESSED"), any(LocalDateTime.class)))
                .thenReturn(List.of(item));

        // AI returns empty cards array
        when(aiService.generateInsight(anyString(), eq(userId)))
                .thenReturn("{\"cards\": []}");

        // When
        reviewCardGenerationService.generateTodayReviewCard(userId);

        // Then — no card should be saved
        verify(reviewCardRepository, never()).save(any());
    }

    @Test
    void generateTodayReviewCard_handlesMissingCardsKey() throws Exception {
        // Given
        Long userId = 1L;

        InformationItem item = createItem(1L, "测试", "BILIBILI", 60, 20);

        when(informationItemRepository.findByUserIdAndProcessStatusAndAnalyzedAtAfter(
                eq(userId), eq("PROCESSED"), any(LocalDateTime.class)))
                .thenReturn(List.of(item));

        // AI returns response without "cards" key
        when(aiService.generateInsight(anyString(), eq(userId)))
                .thenReturn("{\"otherData\": \"no cards here\"}");

        // When
        reviewCardGenerationService.generateTodayReviewCard(userId);

        // Then — no card should be saved
        verify(reviewCardRepository, never()).save(any());
    }

    @Test
    void generateTodayReviewCard_handlesAiException() throws Exception {
        // Given
        Long userId = 1L;

        InformationItem item = createItem(1L, "测试", "BILIBILI", 60, 20);

        when(informationItemRepository.findByUserIdAndProcessStatusAndAnalyzedAtAfter(
                eq(userId), eq("PROCESSED"), any(LocalDateTime.class)))
                .thenReturn(List.of(item));

        when(aiService.generateInsight(anyString(), eq(userId)))
                .thenThrow(new RuntimeException("AI service error"));

        // When / Then
        assertThatThrownBy(() -> reviewCardGenerationService.generateTodayReviewCard(userId))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("生成复习卡片失败");
    }

    @Test
    void generateTodayReviewCard_skipsInvalidCardInResponse() throws Exception {
        // Given
        Long userId = 1L;

        InformationItem item = createItem(1L, "测试", "BILIBILI", 60, 20);

        when(informationItemRepository.findByUserIdAndProcessStatusAndAnalyzedAtAfter(
                eq(userId), eq("PROCESSED"), any(LocalDateTime.class)))
                .thenReturn(List.of(item));

        // One card with null title, one valid card
        String aiResponse = "{\"cards\":["
                + "{\"title\":null,\"content\":\"无效卡片\",\"sourcePlatform\":\"BILIBILI\"},"
                + "{\"title\":\"有效卡片\",\"content\":\"有效内容\",\"sourcePlatform\":\"ZHIHU\"}"
                + "]}";
        when(aiService.generateInsight(anyString(), eq(userId))).thenReturn(aiResponse);

        when(reviewCardRepository.save(any(ReviewCard.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        // When
        reviewCardGenerationService.generateTodayReviewCard(userId);

        // Then — only the valid card should be saved
        verify(reviewCardRepository, times(1)).save(reviewCardCaptor.capture());
        assertThat(reviewCardCaptor.getValue().getTitle()).isEqualTo("有效卡片");
    }

    // ========== processFeedback tests ==========

    private ReviewCard createReviewCard(Long id, Long userId, int repetitionCount,
                                          double easinessFactor, int intervalDays) {
        ReviewCard card = new ReviewCard();
        card.setId(id);
        card.setUserId(userId);
        card.setTitle("测试卡片");
        card.setContent("测试内容");
        card.setSourcePlatform("InfoDigest");
        card.setRepetitionCount(repetitionCount);
        card.setEasinessFactor(easinessFactor);
        card.setIntervalDays(intervalDays);
        card.setScheduledReviewDate(LocalDate.now());
        return card;
    }

    @Test
    void processFeedback_remembered_firstRepetition() {
        // Given — repetitionCount = 0
        Long userId = 1L;
        ReviewCard card = createReviewCard(1L, userId, 0, 2.5, 0);

        when(reviewCardRepository.findById(1L)).thenReturn(Optional.of(card));
        when(reviewCardRepository.save(any(ReviewCard.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        // When
        reviewCardGenerationService.processFeedback(1L, userId, true);

        // Then — SM-2: first interval = 1, EF += 0.1, repetitionCount = 1
        verify(reviewCardRepository).save(reviewCardCaptor.capture());
        ReviewCard saved = reviewCardCaptor.getValue();
        assertThat(saved.getRepetitionCount()).isEqualTo(1);
        assertThat(saved.getIntervalDays()).isEqualTo(1);
        assertThat(saved.getEasinessFactor()).isEqualTo(2.6);
    }

    @Test
    void processFeedback_remembered_secondRepetition() {
        // Given — repetitionCount = 1
        Long userId = 1L;
        ReviewCard card = createReviewCard(1L, userId, 1, 2.5, 1);

        when(reviewCardRepository.findById(1L)).thenReturn(Optional.of(card));
        when(reviewCardRepository.save(any(ReviewCard.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        // When
        reviewCardGenerationService.processFeedback(1L, userId, true);

        // Then — SM-2: second interval = 6, EF += 0.1, repetitionCount = 2
        verify(reviewCardRepository).save(reviewCardCaptor.capture());
        ReviewCard saved = reviewCardCaptor.getValue();
        assertThat(saved.getRepetitionCount()).isEqualTo(2);
        assertThat(saved.getIntervalDays()).isEqualTo(6);
        assertThat(saved.getEasinessFactor()).isEqualTo(2.6);
    }

    @Test
    void processFeedback_remembered_advancedRepetition() {
        // Given — repetitionCount = 2, intervalDays = 6, EF = 2.5
        Long userId = 1L;
        ReviewCard card = createReviewCard(1L, userId, 2, 2.5, 6);

        when(reviewCardRepository.findById(1L)).thenReturn(Optional.of(card));
        when(reviewCardRepository.save(any(ReviewCard.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        // When
        reviewCardGenerationService.processFeedback(1L, userId, true);

        // Then — SM-2: next interval = round(6 * 2.5) = 15, EF += 0.1 = 2.6
        verify(reviewCardRepository).save(reviewCardCaptor.capture());
        ReviewCard saved = reviewCardCaptor.getValue();
        assertThat(saved.getRepetitionCount()).isEqualTo(3);
        assertThat(saved.getIntervalDays()).isEqualTo(15);
        assertThat(saved.getEasinessFactor()).isEqualTo(2.6);
    }

    @Test
    void processFeedback_forgotten_resetsProgress() {
        // Given — previously learned card with EF = 2.5
        Long userId = 1L;
        ReviewCard card = createReviewCard(1L, userId, 3, 2.5, 15);

        when(reviewCardRepository.findById(1L)).thenReturn(Optional.of(card));
        when(reviewCardRepository.save(any(ReviewCard.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        // When — forgotten
        reviewCardGenerationService.processFeedback(1L, userId, false);

        // Then — resets: repetitionCount=0, intervalDays=0, EF -= 0.2 = 2.3
        verify(reviewCardRepository).save(reviewCardCaptor.capture());
        ReviewCard saved = reviewCardCaptor.getValue();
        assertThat(saved.getRepetitionCount()).isEqualTo(0);
        assertThat(saved.getIntervalDays()).isEqualTo(0);
        assertThat(saved.getEasinessFactor()).isEqualTo(2.3);
    }

    @Test
    void processFeedback_forgotten_clampsEasinessFactor() {
        // Given — low EF = 1.4, subtract 0.2 → 1.2, clamped to 1.3
        Long userId = 1L;
        ReviewCard card = createReviewCard(1L, userId, 1, 1.4, 1);

        when(reviewCardRepository.findById(1L)).thenReturn(Optional.of(card));
        when(reviewCardRepository.save(any(ReviewCard.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        // When
        reviewCardGenerationService.processFeedback(1L, userId, false);

        // Then — EF clamped to min 1.3
        verify(reviewCardRepository).save(reviewCardCaptor.capture());
        assertThat(reviewCardCaptor.getValue().getEasinessFactor()).isEqualTo(1.3);
    }

    @Test
    void processFeedback_cardNotFound_throwsException() {
        // Given
        when(reviewCardRepository.findById(99L)).thenReturn(Optional.empty());

        // When / Then
        assertThatThrownBy(() -> reviewCardGenerationService.processFeedback(99L, 1L, true))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Card not found");

        verify(reviewCardRepository, never()).save(any());
    }

    @Test
    void processFeedback_unauthorizedAccess_throwsException() {
        // Given — card belongs to userId=2, but passed userId=1
        Long userId = 1L;
        ReviewCard card = createReviewCard(1L, 2L, 0, 2.5, 0);

        when(reviewCardRepository.findById(1L)).thenReturn(Optional.of(card));

        // When / Then
        assertThatThrownBy(() -> reviewCardGenerationService.processFeedback(1L, userId, true))
                .isInstanceOf(SecurityException.class)
                .hasMessage("Unauthorized access to this card");

        verify(reviewCardRepository, never()).save(any());
    }

    // ========== Additional edge-case tests ==========

    @Test
    void processFeedback_remembered_withNullFields() {
        // Given — card with null repetition fields, should use defaults (0, 2.5, 0)
        Long userId = 1L;
        ReviewCard card = createReviewCard(1L, userId, 0, 2.5, 0);
        card.setRepetitionCount(null);
        card.setEasinessFactor(null);
        card.setIntervalDays(null);

        when(reviewCardRepository.findById(1L)).thenReturn(Optional.of(card));
        when(reviewCardRepository.save(any(ReviewCard.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        // When
        reviewCardGenerationService.processFeedback(1L, userId, true);

        // Then — defaults apply: repetitionCount=0 → first repetition, interval=1, EF=2.6
        verify(reviewCardRepository).save(reviewCardCaptor.capture());
        ReviewCard saved = reviewCardCaptor.getValue();
        assertThat(saved.getRepetitionCount()).isEqualTo(1);
        assertThat(saved.getIntervalDays()).isEqualTo(1);
        assertThat(saved.getEasinessFactor()).isEqualTo(2.6);
    }

    @Test
    void processFeedback_forgotten_minimumEfAlreadyAtMin() {
        // Given — EF already at minimum 1.3, subtract 0.2 → clamped to 1.3
        Long userId = 1L;
        ReviewCard card = createReviewCard(1L, userId, 3, 1.3, 15);

        when(reviewCardRepository.findById(1L)).thenReturn(Optional.of(card));
        when(reviewCardRepository.save(any(ReviewCard.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        // When
        reviewCardGenerationService.processFeedback(1L, userId, false);

        // Then — EF stays at 1.3 (clamped)
        verify(reviewCardRepository).save(reviewCardCaptor.capture());
        assertThat(reviewCardCaptor.getValue().getEasinessFactor()).isEqualTo(1.3);
    }

    @Test
    void processFeedback_remembered_intervalDaysZeroWhenRepetitionAboveTwo() {
        // Given — repetitionCount=2, intervalDays=0, EF=2.5
        // When remembered, interval = round(0 * 2.5) = 0
        Long userId = 1L;
        ReviewCard card = createReviewCard(1L, userId, 2, 2.5, 0);

        when(reviewCardRepository.findById(1L)).thenReturn(Optional.of(card));
        when(reviewCardRepository.save(any(ReviewCard.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        // When
        reviewCardGenerationService.processFeedback(1L, userId, true);

        // Then — intervalDays = round(0 * 2.5) = 0
        verify(reviewCardRepository).save(reviewCardCaptor.capture());
        ReviewCard saved = reviewCardCaptor.getValue();
        assertThat(saved.getRepetitionCount()).isEqualTo(3);
        assertThat(saved.getIntervalDays()).isEqualTo(0);
        assertThat(saved.getEasinessFactor()).isEqualTo(2.6);
    }

    @Test
    void generateTodayReviewCard_handlesNullNutritionFields() throws Exception {
        // Given — items with null nutrition values
        Long userId = 1L;

        InformationItem item = createItem(1L, "空营养测试", "BILIBILI", null, null);

        when(informationItemRepository.findByUserIdAndProcessStatusAndAnalyzedAtAfter(
                eq(userId), eq("PROCESSED"), any(LocalDateTime.class)))
                .thenReturn(List.of(item));

        String aiResponse = "{\"cards\":[{\"title\":\"空营养\",\"content\":\"内容\",\"sourcePlatform\":\"BILIBILI\"}]}";
        lenient().when(aiService.generateInsight(anyString(), eq(userId))).thenReturn(aiResponse);

        when(reviewCardRepository.save(any(ReviewCard.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        // When
        reviewCardGenerationService.generateTodayReviewCard(userId);

        // Then — null nutrition is handled (null < 30 → not valuable → falls back to all items)
        verify(reviewCardRepository).save(reviewCardCaptor.capture());
        assertThat(reviewCardCaptor.getValue().getTitle()).isEqualTo("空营养");
    }
}
