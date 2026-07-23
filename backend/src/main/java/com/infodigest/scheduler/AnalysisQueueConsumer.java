package com.infodigest.scheduler;

import com.infodigest.service.ContentAnalysisService;
import lombok.extern.slf4j.Slf4j;
import org.redisson.api.RBlockingDeque;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

@Component
@Slf4j
public class AnalysisQueueConsumer {

    @Autowired
    @Qualifier("analysisQueue")
    private RBlockingDeque<Long> analysisQueue;

    @Autowired
    private ContentAnalysisService analysisService;

    private ExecutorService consumerThread;

    // 连续失败计数，用于指数退避
    private int consecutiveFailures = 0;
    private static final int MAX_BACKOFF_SECONDS = 120;

    @PostConstruct
    public void startConsuming() {
        consumerThread = Executors.newSingleThreadExecutor(r -> {
            Thread t = new Thread(r, "analysis-queue-consumer");
            t.setDaemon(true);
            return t;
        });

        consumerThread.submit(() -> {
            log.info("Redis 队列消费者启动，监听 queue:ai-analysis");
            while (!Thread.currentThread().isInterrupted()) {
                try {
                    // 阻塞等待，30 秒超时方便优雅关闭
                    Long itemId = analysisQueue.poll(30, TimeUnit.SECONDS);
                    if (itemId != null) {
                        log.info("从队列取出任务: itemId={}", itemId);
                        try {
                            analysisService.analyzeItem(itemId);
                            // 成功后重置退避计数
                            consecutiveFailures = 0;
                        } catch (Exception e) {
                            String msg = e.getMessage() != null ? e.getMessage() : "";
                            if (msg.contains("429") || msg.toLowerCase().contains("rate limit")) {
                                consecutiveFailures++;
                                int backoffSeconds = Math.min(
                                        (int) Math.pow(2, consecutiveFailures) * 5,
                                        MAX_BACKOFF_SECONDS);
                                log.warn("[QueueConsumer] ⚠️ API 速率限制 (第{}次), 等待 {}秒后重试",
                                        consecutiveFailures, backoffSeconds);
                                Thread.sleep(backoffSeconds * 1000L);
                            } else {
                                consecutiveFailures = 0;
                                log.error("[QueueConsumer] 分析 itemId={} 失败: {}", itemId, msg);
                            }
                        }
                    }
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    break;
                } catch (Exception e) {
                    log.error("[QueueConsumer] 队列消费异常（安全捕获）: {}", e.getMessage());
                    // 防止异常导致消费者死循环空转
                    try {
                        Thread.sleep(5000);
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        break;
                    }
                }
            }
            log.info("Redis 队列消费者已停止");
        });
    }

    @PreDestroy
    public void stopConsuming() {
        if (consumerThread != null) {
            consumerThread.shutdownNow();
        }
    }
}
