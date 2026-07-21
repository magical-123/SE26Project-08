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
                        } catch (Exception e) {
                            log.error("分析 itemId={} 失败: {}", itemId, e.getMessage(), e);
                        }
                    }
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    break;
                } catch (Exception e) {
                    log.error("队列消费异常: {}", e.getMessage(), e);
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
