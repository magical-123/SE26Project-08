package com.infodigest.scheduler;

import com.infodigest.entity.AIConfig;
import com.infodigest.entity.InformationItem;
import com.infodigest.repository.AIConfigRepository;
import com.infodigest.repository.InformationItemRepository;
import com.infodigest.service.ContentAnalysisService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageRequest;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ContentAnalysisSchedulerTest {

    @Mock
    private InformationItemRepository itemRepository;

    @Mock
    private ContentAnalysisService analysisService;

    @Mock
    private AIConfigRepository aiConfigRepository;

    @InjectMocks
    private ContentAnalysisScheduler contentAnalysisScheduler;

    @Test
    void scanAndAnalyzeItems_processesItemsWithoutSummary() throws Exception {
        // Given
        AIConfig config = new AIConfig();
        config.setUserId(1L);
        when(aiConfigRepository.findAll()).thenReturn(List.of(config));

        InformationItem item = new InformationItem();
        item.setId(100L);
        List<InformationItem> itemsWithoutSummary = List.of(item);
        when(itemRepository.findWithoutSummaryPriorityNonEntertainment(
                anyList(), anySet(), any(PageRequest.class))).thenReturn(itemsWithoutSummary);

        List<InformationItem> unprocessedItems = List.of();
        when(itemRepository.findByProcessStatusAndUserIdIn(
                eq("UNPROCESSED"), anySet(), any(PageRequest.class))).thenReturn(unprocessedItems);

        // When
        contentAnalysisScheduler.scanAndAnalyzeItems();

        // Then
        verify(analysisService, atLeastOnce()).analyzeItem(100L);
    }

    @Test
    void scanAndAnalyzeItems_supplementsWithUnprocessedItemsWhenBatchNotFull() throws Exception {
        // Given
        AIConfig config = new AIConfig();
        config.setUserId(1L);
        when(aiConfigRepository.findAll()).thenReturn(List.of(config));

        // Only 2 items without summary, well below BATCH_SIZE (10)
        InformationItem item1 = new InformationItem();
        item1.setId(101L);
        InformationItem item2 = new InformationItem();
        item2.setId(102L);
        List<InformationItem> itemsWithoutSummary = List.of(item1, item2);
        when(itemRepository.findWithoutSummaryPriorityNonEntertainment(
                anyList(), anySet(), any(PageRequest.class))).thenReturn(itemsWithoutSummary);

        // Supplement returns 3 unprocessed items, one overlapping (102L), two new
        InformationItem supplemental1 = new InformationItem();
        supplemental1.setId(102L); // Overlapping ID
        InformationItem supplemental2 = new InformationItem();
        supplemental2.setId(103L); // New
        InformationItem supplemental3 = new InformationItem();
        supplemental3.setId(104L); // New
        List<InformationItem> unprocessedItems = List.of(supplemental1, supplemental2, supplemental3);
        when(itemRepository.findByProcessStatusAndUserIdIn(
                eq("UNPROCESSED"), anySet(), any(PageRequest.class))).thenReturn(unprocessedItems);

        // When
        contentAnalysisScheduler.scanAndAnalyzeItems();

        // Then - all 4 unique items (101, 102, 103, 104) should be analyzed
        verify(analysisService).analyzeItem(101L);
        verify(analysisService).analyzeItem(102L);
        verify(analysisService).analyzeItem(103L);
        verify(analysisService).analyzeItem(104L);
    }

    @Test
    void scanAndAnalyzeItems_skipsWhenNoItemsFound() throws Exception {
        // Given
        AIConfig config = new AIConfig();
        config.setUserId(1L);
        when(aiConfigRepository.findAll()).thenReturn(List.of(config));

        // Both queries return empty lists
        when(itemRepository.findWithoutSummaryPriorityNonEntertainment(
                anyList(), anySet(), any(PageRequest.class))).thenReturn(List.of());
        when(itemRepository.findByProcessStatusAndUserIdIn(
                eq("UNPROCESSED"), anySet(), any(PageRequest.class))).thenReturn(List.of());

        // When
        contentAnalysisScheduler.scanAndAnalyzeItems();

        // Then - no items should be analyzed
        verify(analysisService, never()).analyzeItem(anyLong());
    }

    @Test
    void scanAndAnalyzeItems_catchesOuterExceptionGracefully() throws Exception {
        // Given - aiConfigRepository throws to exercise the outer catch
        when(aiConfigRepository.findAll()).thenThrow(new RuntimeException("Unexpected DB error"));

        // When - should not throw
        contentAnalysisScheduler.scanAndAnalyzeItems();

        // Then - no crash, outer catch handled it
        verify(analysisService, never()).analyzeItem(anyLong());
    }

    @Test
    void scanAndAnalyzeItems_skipsWhenNoUsersWithConfig() throws Exception {
        // Given
        when(aiConfigRepository.findAll()).thenReturn(List.of());

        // When
        contentAnalysisScheduler.scanAndAnalyzeItems();

        // Then
        verify(itemRepository, never()).findWithoutSummaryPriorityNonEntertainment(anyList(), anySet(), any(PageRequest.class));
        verify(analysisService, never()).analyzeItem(anyLong());
    }

    @Test
    void scanAndAnalyzeItems_handlesRateLimitingGracefully() throws Exception {
        // Given
        AIConfig config = new AIConfig();
        config.setUserId(1L);
        when(aiConfigRepository.findAll()).thenReturn(List.of(config));

        InformationItem item1 = new InformationItem();
        item1.setId(100L);
        InformationItem item2 = new InformationItem();
        item2.setId(200L);
        List<InformationItem> itemsWithoutSummary = List.of(item1, item2);
        when(itemRepository.findWithoutSummaryPriorityNonEntertainment(
                anyList(), anySet(), any(PageRequest.class))).thenReturn(itemsWithoutSummary);

        List<InformationItem> unprocessedItems = List.of();
        when(itemRepository.findByProcessStatusAndUserIdIn(
                eq("UNPROCESSED"), anySet(), any(PageRequest.class))).thenReturn(unprocessedItems);

        // First item succeeds, second item triggers rate limit
        doNothing().when(analysisService).analyzeItem(100L);
        doThrow(new RuntimeException("429 Too Many Requests")).when(analysisService).analyzeItem(200L);

        // When
        contentAnalysisScheduler.scanAndAnalyzeItems();

        // Then - first item was analyzed, second triggered rate limit and loop broke
        verify(analysisService).analyzeItem(100L);
        verify(analysisService).analyzeItem(200L);
    }

    @Test
    void scanAndAnalyzeItems_logsDiagnosticStatsOnPostConstruct() {
        // Given
        AIConfig config = new AIConfig();
        config.setUserId(1L);
        when(aiConfigRepository.findAll()).thenReturn(List.of(config));

        InformationItem item = new InformationItem();
        item.setId(100L);
        item.setProcessStatus("UNPROCESSED");
        item.setAiSummary(null);
        when(itemRepository.findByUserId(1L)).thenReturn(List.of(item));

        // When
        contentAnalysisScheduler.logDiagnosticStats();

        // Then - no exception, method runs successfully
        verify(aiConfigRepository).findAll();
        verify(itemRepository).findByUserId(1L);
    }

    @Test
    void analyzeItemAsync_manuallyTriggersAnalysis() throws Exception {
        // Given
        Long itemId = 42L;

        // When
        contentAnalysisScheduler.analyzeItemAsync(itemId);

        // Then
        verify(analysisService).analyzeItem(itemId);
    }

    @Test
    void analyzeItemAsync_handlesFailureGracefully() throws Exception {
        // Given
        Long itemId = 99L;
        doThrow(new RuntimeException("Analysis failed")).when(analysisService).analyzeItem(itemId);

        // When - should not propagate exception
        contentAnalysisScheduler.analyzeItemAsync(itemId);

        // Then
        verify(analysisService).analyzeItem(itemId);
    }

    @Test
    void scanAndAnalyzeItems_handlesNonRateLimitFailure() throws Exception {
        // Given
        AIConfig config = new AIConfig();
        config.setUserId(1L);
        when(aiConfigRepository.findAll()).thenReturn(List.of(config));

        InformationItem item = new InformationItem();
        item.setId(100L);
        when(itemRepository.findWithoutSummaryPriorityNonEntertainment(
                anyList(), anySet(), any(PageRequest.class))).thenReturn(List.of(item));
        when(itemRepository.findByProcessStatusAndUserIdIn(
                eq("UNPROCESSED"), anySet(), any(PageRequest.class))).thenReturn(List.of());

        // Non-rate-limit exception (regular failure)
        doThrow(new RuntimeException("Internal server error")).when(analysisService).analyzeItem(100L);

        // When
        contentAnalysisScheduler.scanAndAnalyzeItems();

        // Then - item was attempted, failure counted but no crash
        verify(analysisService).analyzeItem(100L);
    }

    @Test
    void logDiagnosticStats_catchesExceptionGracefully() {
        // Given - aiConfigRepository throws in logDiagnosticStats
        when(aiConfigRepository.findAll()).thenThrow(new RuntimeException("DB error"));

        // When - should not propagate exception
        contentAnalysisScheduler.logDiagnosticStats();

        // Then
        verify(aiConfigRepository).findAll();
    }
}
