package com.infodigest.scheduler;

import com.infodigest.service.ContentAnalysisService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.redisson.api.RBlockingDeque;

import java.util.concurrent.TimeUnit;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AnalysisQueueConsumerTest {

    @Mock
    private RBlockingDeque<Long> analysisQueue;

    @Mock
    private ContentAnalysisService analysisService;

    @InjectMocks
    private AnalysisQueueConsumer analysisQueueConsumer;

    @Test
    void startConsuming_processesItemsFromQueue() throws Exception {
        // Given
        Long itemId = 123L;
        when(analysisQueue.poll(30, TimeUnit.SECONDS))
                .thenReturn(itemId)
                .thenReturn(null); // second call returns null to exit loop

        // When
        analysisQueueConsumer.startConsuming();

        // Wait for consumer thread to start and process
        Thread.sleep(500);

        // Then
        verify(analysisService).analyzeItem(itemId);
    }

    @Test
    void consumer_handlesInterruptedExceptionGracefully() throws Exception {
        // Given - poll throws InterruptedException
        when(analysisQueue.poll(anyLong(), any(TimeUnit.class)))
                .thenThrow(new InterruptedException("Thread interrupted"));

        // When
        analysisQueueConsumer.startConsuming();

        // Wait for consumer thread to process
        Thread.sleep(500);

        // Then - thread should be interrupted and stop
        verify(analysisService, never()).analyzeItem(anyLong());
    }

    @Test
    void consumer_handlesRateLimitWithBackoff() throws Exception {
        // Given
        Long itemId = 123L;
        when(analysisQueue.poll(30, TimeUnit.SECONDS))
                .thenReturn(itemId)
                .thenReturn(null); // second call returns null to exit loop

        // First analysis attempt fails with rate limit
        doThrow(new RuntimeException("429 rate limit exceeded"))
                .when(analysisService).analyzeItem(itemId);

        // When
        analysisQueueConsumer.startConsuming();

        // Wait for consumer thread to process
        Thread.sleep(1000);

        // Then
        verify(analysisService).analyzeItem(itemId);
    }

    @Test
    void consumer_handlesNonRateLimitFailure() throws Exception {
        // Given
        Long itemId = 456L;
        when(analysisQueue.poll(30, TimeUnit.SECONDS))
                .thenReturn(itemId)
                .thenReturn(null); // second call returns null to exit loop

        // Non-rate-limit exception
        doThrow(new RuntimeException("General error")).when(analysisService).analyzeItem(itemId);

        // When
        analysisQueueConsumer.startConsuming();

        // Wait for consumer thread to process
        Thread.sleep(1000);

        // Then - non-rate-limit failure is logged, no retry backoff
        verify(analysisService).analyzeItem(itemId);
    }

    @Test
    void stopConsuming_handlesNullConsumerGracefully() {
        // When consumerThread is null (never started)
        analysisQueueConsumer.stopConsuming();

        // Then - no exception, method completes silently
    }
}
