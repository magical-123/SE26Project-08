package com.infodigest.scheduler;

import com.infodigest.repository.InformationItemRepository;
import com.infodigest.repository.QuoteExtractRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DataRetentionSchedulerTest {

    @Mock
    private InformationItemRepository itemRepository;

    @Mock
    private QuoteExtractRepository quoteExtractRepository;

    @InjectMocks
    private DataRetentionScheduler dataRetentionScheduler;

    @Test
    void cleanExpiredItems_deletesExpiredItemsAndRelatedQuotes() {
        // Given
        List<Long> expiredIds = List.of(1L, 2L, 3L);
        when(itemRepository.findExpiredNonPremiumItemIds(any(LocalDateTime.class))).thenReturn(expiredIds);
        when(itemRepository.countByIsPremiumTrue()).thenReturn(5L);

        // When
        dataRetentionScheduler.cleanExpiredItems();

        // Then
        verify(itemRepository).findExpiredNonPremiumItemIds(any(LocalDateTime.class));
        verify(quoteExtractRepository).deleteByItemIdIn(expiredIds);
        verify(itemRepository).deleteAllByIdInBatch(expiredIds);
        verify(itemRepository).countByIsPremiumTrue();
    }

    @Test
    void cleanExpiredItems_logsInfoWhenNoExpiredItems() {
        // Given
        when(itemRepository.findExpiredNonPremiumItemIds(any(LocalDateTime.class))).thenReturn(List.of());

        // When
        dataRetentionScheduler.cleanExpiredItems();

        // Then
        verify(itemRepository).findExpiredNonPremiumItemIds(any(LocalDateTime.class));
        verify(quoteExtractRepository, never()).deleteByItemIdIn(anyList());
        verify(itemRepository, never()).deleteAllByIdInBatch(anyList());
    }

    @Test
    void cleanExpiredItems_handlesExceptionGracefully() {
        // Given
        when(itemRepository.findExpiredNonPremiumItemIds(any(LocalDateTime.class)))
                .thenThrow(new RuntimeException("Database error"));

        // When & Then - exception propagates (Spring scheduler framework handles it)
        assertThatThrownBy(() -> dataRetentionScheduler.cleanExpiredItems())
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Database error");

        verify(itemRepository).findExpiredNonPremiumItemIds(any(LocalDateTime.class));
        verify(quoteExtractRepository, never()).deleteByItemIdIn(anyList());
        verify(itemRepository, never()).deleteAllByIdInBatch(anyList());
    }
}
