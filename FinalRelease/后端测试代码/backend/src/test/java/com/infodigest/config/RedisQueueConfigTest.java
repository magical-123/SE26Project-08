package com.infodigest.config;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.redisson.api.RBlockingDeque;
import org.redisson.api.RDelayedQueue;
import org.redisson.api.RedissonClient;

import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RedisQueueConfigTest {

    @Mock
    private RedissonClient redissonClient;

    private final RedisQueueConfig config = new RedisQueueConfig();

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void analysisQueue_usesCorrectQueueName() {
        RBlockingDeque mockQueue = org.mockito.Mockito.mock(RBlockingDeque.class);
        when(redissonClient.getBlockingDeque("queue:ai-analysis")).thenReturn(mockQueue);

        RBlockingDeque<Long> result = config.analysisQueue(redissonClient);

        assertSame(mockQueue, result);
        verify(redissonClient).getBlockingDeque("queue:ai-analysis");
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void delayedAnalysisQueue_usesCorrectQueue() {
        RBlockingDeque mockQueue = org.mockito.Mockito.mock(RBlockingDeque.class);
        RDelayedQueue mockDelayedQueue = org.mockito.Mockito.mock(RDelayedQueue.class);
        when(redissonClient.getDelayedQueue(mockQueue)).thenReturn(mockDelayedQueue);

        RDelayedQueue<Long> result = config.delayedAnalysisQueue(redissonClient, mockQueue);

        assertSame(mockDelayedQueue, result);
        verify(redissonClient).getDelayedQueue(mockQueue);
    }
}
