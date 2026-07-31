package com.infodigest.controller;

import com.infodigest.entity.ReviewCard;
import com.infodigest.entity.User;
import com.infodigest.repository.ReviewCardRepository;
import com.infodigest.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ReviewCardControllerTest {

    @Mock
    private ReviewCardRepository reviewCardRepository;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private ReviewCardController controller;

    private final User currentUser = new User();

    @BeforeEach
    void setUp() {
        currentUser.setId(1L);
        currentUser.setUsername("testuser");
        when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(currentUser));
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("testuser", null, java.util.List.of()));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void getTodayCards_ReturnsTodayReviewCards() {
        // Given
        ReviewCard card1 = new ReviewCard();
        card1.setId(1L);
        card1.setUserId(1L);
        card1.setTitle("什么是LoRA?");
        card1.setContent("一种微调大模型的高效技术");
        card1.setScheduledReviewDate(LocalDate.now());

        ReviewCard card2 = new ReviewCard();
        card2.setId(2L);
        card2.setUserId(1L);
        card2.setTitle("设计心理学：锚定效应");
        card2.setContent("人们在做决策时过度依赖最初获得的信息");
        card2.setScheduledReviewDate(LocalDate.now());

        when(reviewCardRepository.findByUserIdAndScheduledReviewDate(eq(1L), any(LocalDate.class)))
                .thenReturn(List.of(card1, card2));

        // When
        ResponseEntity<List<ReviewCard>> response = controller.getReviewCards(null);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        List<ReviewCard> body = response.getBody();
        assertNotNull(body);
        assertEquals(2, body.size());
        assertEquals("什么是LoRA?", body.get(0).getTitle());
        verify(reviewCardRepository).findByUserIdAndScheduledReviewDate(eq(1L), any(LocalDate.class));
    }

    @Test
    void markReviewed_UpdatesCardStatus() {
        // Given
        ReviewCard existingCard = new ReviewCard();
        existingCard.setId(1L);
        existingCard.setUserId(1L);
        existingCard.setTitle("原标题");
        existingCard.setContent("原内容");
        existingCard.setSourcePlatform("BILIBILI");

        ReviewCard cardDetails = new ReviewCard();
        cardDetails.setTitle("新标题");
        cardDetails.setContent("新内容");
        cardDetails.setSourcePlatform("ZHIHU");

        when(reviewCardRepository.findById(1L)).thenReturn(Optional.of(existingCard));
        when(reviewCardRepository.save(any(ReviewCard.class))).thenAnswer(invocation -> invocation.getArgument(0));

        // When
        ResponseEntity<ReviewCard> response = controller.updateReviewCard(1L, cardDetails);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        ReviewCard body = response.getBody();
        assertNotNull(body);
        assertEquals("新标题", body.getTitle());
        assertEquals("新内容", body.getContent());
        assertEquals("ZHIHU", body.getSourcePlatform());
        verify(reviewCardRepository).save(existingCard);
    }

    @Test
    void markReviewed_ReturnsNotFoundForNonExistentCard() {
        // Given
        when(reviewCardRepository.findById(999L)).thenReturn(Optional.empty());

        // When
        ResponseEntity<ReviewCard> response = controller.updateReviewCard(999L, new ReviewCard());

        // Then
        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
    }

    @Test
    void generateCards_CreatesNewCard() {
        // Given
        ReviewCard newCard = new ReviewCard();
        newCard.setTitle("新卡片");
        newCard.setContent("新卡片内容");
        newCard.setSourcePlatform("BILIBILI");

        ReviewCard savedCard = new ReviewCard();
        savedCard.setId(1L);
        savedCard.setUserId(1L);
        savedCard.setTitle("新卡片");
        savedCard.setContent("新卡片内容");
        savedCard.setSourcePlatform("BILIBILI");
        savedCard.setScheduledReviewDate(LocalDate.now());

        when(reviewCardRepository.save(any(ReviewCard.class))).thenReturn(savedCard);

        // When
        ResponseEntity<ReviewCard> response = controller.createReviewCard(newCard);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        ReviewCard body = response.getBody();
        assertNotNull(body);
        assertEquals("新卡片", body.getTitle());
        assertEquals(1L, body.getUserId());
        assertEquals(LocalDate.now(), body.getScheduledReviewDate());
        verify(reviewCardRepository).save(any(ReviewCard.class));
    }

    @Test
    void generateCards_SetsUserIdAndDate() {
        // Given
        ReviewCard newCard = new ReviewCard();
        newCard.setTitle("新卡片");
        newCard.setContent("内容");

        ReviewCard savedCard = new ReviewCard();
        savedCard.setId(2L);
        savedCard.setUserId(1L);
        savedCard.setTitle("新卡片");
        savedCard.setContent("内容");
        savedCard.setScheduledReviewDate(LocalDate.now());

        when(reviewCardRepository.save(any(ReviewCard.class))).thenReturn(savedCard);

        // When
        ResponseEntity<ReviewCard> response = controller.createReviewCard(newCard);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        ReviewCard body = response.getBody();
        assertNotNull(body);
        assertEquals(1L, body.getUserId());
        assertEquals(LocalDate.now(), body.getScheduledReviewDate());
    }

    @Test
    void getReviewCard_ReturnsCard() {
        // Given
        ReviewCard card = new ReviewCard();
        card.setId(1L);
        card.setUserId(1L);
        card.setTitle("测试卡片");
        card.setContent("测试内容");

        when(reviewCardRepository.findById(1L)).thenReturn(Optional.of(card));

        // When
        ResponseEntity<ReviewCard> response = controller.getReviewCard(1L);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        ReviewCard body = response.getBody();
        assertNotNull(body);
        assertEquals("测试卡片", body.getTitle());
    }

    @Test
    void getReviewCard_NotFound_ReturnsNotFound() {
        // Given
        when(reviewCardRepository.findById(999L)).thenReturn(Optional.empty());

        // When
        ResponseEntity<ReviewCard> response = controller.getReviewCard(999L);

        // Then
        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
    }

    @Test
    void getReviewCard_DifferentUser_ReturnsNotFound() {
        // Given
        ReviewCard card = new ReviewCard();
        card.setId(1L);
        card.setUserId(2L);
        card.setTitle("其他人的卡片");

        when(reviewCardRepository.findById(1L)).thenReturn(Optional.of(card));

        // When
        ResponseEntity<ReviewCard> response = controller.getReviewCard(1L);

        // Then
        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
    }

    @Test
    void deleteReviewCard_DeletesCard() {
        // Given
        ReviewCard card = new ReviewCard();
        card.setId(1L);
        card.setUserId(1L);

        when(reviewCardRepository.findById(1L)).thenReturn(Optional.of(card));

        // When
        ResponseEntity<Void> response = controller.deleteReviewCard(1L);

        // Then
        assertEquals(HttpStatus.NO_CONTENT, response.getStatusCode());
        verify(reviewCardRepository).deleteById(1L);
    }

    @Test
    void deleteReviewCard_NotFound_ReturnsNotFound() {
        // Given
        when(reviewCardRepository.findById(999L)).thenReturn(Optional.empty());

        // When
        ResponseEntity<Void> response = controller.deleteReviewCard(999L);

        // Then
        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
        verify(reviewCardRepository, never()).deleteById(any());
    }

    @Test
    void deleteReviewCard_DifferentUser_ReturnsNotFound() {
        // Given
        ReviewCard card = new ReviewCard();
        card.setId(1L);
        card.setUserId(2L);

        when(reviewCardRepository.findById(1L)).thenReturn(Optional.of(card));

        // When
        ResponseEntity<Void> response = controller.deleteReviewCard(1L);

        // Then
        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
        verify(reviewCardRepository, never()).deleteById(any());
    }

    @Test
    void getReviewCards_WithDate_ReturnsCardsForSpecificDate() {
        // Given
        LocalDate specificDate = LocalDate.now().minusDays(1);
        ReviewCard card = new ReviewCard();
        card.setId(1L);
        card.setUserId(1L);
        card.setTitle("昨日卡片");
        card.setScheduledReviewDate(specificDate);

        when(reviewCardRepository.findByUserIdAndScheduledReviewDate(eq(1L), eq(specificDate)))
                .thenReturn(List.of(card));

        // When
        ResponseEntity<List<ReviewCard>> response = controller.getReviewCards(specificDate);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        List<ReviewCard> body = response.getBody();
        assertNotNull(body);
        assertEquals(1, body.size());
        assertEquals("昨日卡片", body.get(0).getTitle());
        verify(reviewCardRepository).findByUserIdAndScheduledReviewDate(eq(1L), eq(specificDate));
    }

    @Test
    void updateReviewCard_DifferentUser_ReturnsNotFound() {
        // Given
        ReviewCard existingCard = new ReviewCard();
        existingCard.setId(1L);
        existingCard.setUserId(2L);
        existingCard.setTitle("原标题");

        ReviewCard cardDetails = new ReviewCard();
        cardDetails.setTitle("新标题");

        when(reviewCardRepository.findById(1L)).thenReturn(Optional.of(existingCard));

        // When
        ResponseEntity<ReviewCard> response = controller.updateReviewCard(1L, cardDetails);

        // Then
        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
        verify(reviewCardRepository, never()).save(any());
    }
}
