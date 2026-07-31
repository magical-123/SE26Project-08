package com.infodigest.controller;

import com.infodigest.entity.QuoteExtract;
import com.infodigest.entity.User;
import com.infodigest.repository.QuoteExtractRepository;
import com.infodigest.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class QuoteExtractControllerTest {

    @Mock
    private QuoteExtractRepository quoteExtractRepository;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private QuoteExtractController controller;

    private final User currentUser = new User();

    @BeforeEach
    void setUp() {
        currentUser.setId(1L);
        currentUser.setUsername("testuser");
        when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(currentUser));
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("testuser", null));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void getQuotes_ReturnsQuotesList() {
        // Given
        List<QuoteExtract> quotes = new ArrayList<>();
        for (int i = 1; i <= 3; i++) {
            QuoteExtract q = new QuoteExtract();
            q.setId((long) i);
            q.setUserId(1L);
            q.setContent("Quote " + i);
            q.setCreatedAt(LocalDateTime.now());
            quotes.add(q);
        }
        when(quoteExtractRepository.findByUserIdOrderByCreatedAtDesc(1L)).thenReturn(quotes);

        // When
        var response = controller.getQuotes();

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        List<QuoteExtract> body = response.getBody();
        assertNotNull(body);
        assertEquals(3, body.size());
        verify(quoteExtractRepository).findByUserIdOrderByCreatedAtDesc(1L);
    }

    @Test
    void getQuotes_LimitsTo20() {
        // Given
        List<QuoteExtract> quotes = new ArrayList<>();
        for (int i = 1; i <= 25; i++) {
            QuoteExtract q = new QuoteExtract();
            q.setId((long) i);
            q.setUserId(1L);
            q.setContent("Quote " + i);
            quotes.add(q);
        }
        when(quoteExtractRepository.findByUserIdOrderByCreatedAtDesc(1L)).thenReturn(quotes);

        // When
        var response = controller.getQuotes();

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        List<QuoteExtract> body = response.getBody();
        assertNotNull(body);
        assertEquals(20, body.size());
    }

    @Test
    void getQuotes_ReturnsEmptyListWhenNoQuotes() {
        // Given
        when(quoteExtractRepository.findByUserIdOrderByCreatedAtDesc(1L)).thenReturn(List.of());

        // When
        var response = controller.getQuotes();

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        List<QuoteExtract> body = response.getBody();
        assertNotNull(body);
        assertTrue(body.isEmpty());
    }

    @Test
    void deleteQuote_SucceedsForOwnQuote() {
        // Given
        QuoteExtract quote = new QuoteExtract();
        quote.setId(10L);
        quote.setUserId(1L);
        quote.setContent("Test quote");
        when(quoteExtractRepository.findById(10L)).thenReturn(Optional.of(quote));

        // When
        var response = controller.deleteQuote(10L);

        // Then
        assertEquals(HttpStatus.NO_CONTENT, response.getStatusCode());
        verify(quoteExtractRepository).delete(quote);
    }

    @Test
    void deleteQuote_Returns403ForOtherUsersQuote() {
        // Given
        QuoteExtract quote = new QuoteExtract();
        quote.setId(10L);
        quote.setUserId(2L); // different user
        quote.setContent("Other user's quote");
        when(quoteExtractRepository.findById(10L)).thenReturn(Optional.of(quote));

        // When
        var response = controller.deleteQuote(10L);

        // Then
        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
        verify(quoteExtractRepository, never()).delete(any());
    }

    @Test
    void deleteQuote_ThrowsWhenNotFound() {
        // Given
        when(quoteExtractRepository.findById(999L)).thenReturn(Optional.empty());

        // When / Then
        RuntimeException exception = assertThrows(RuntimeException.class,
                () -> controller.deleteQuote(999L));
        assertTrue(exception.getMessage().contains("Quote not found"));
        verify(quoteExtractRepository, never()).delete(any());
    }
}
