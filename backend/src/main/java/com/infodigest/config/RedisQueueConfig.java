package com.infodigest.config;

import org.redisson.Redisson;
import org.redisson.api.RBlockingDeque;
import org.redisson.api.RDelayedQueue;
import org.redisson.api.RedissonClient;
import org.redisson.config.Config;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RedisQueueConfig {

    @Value("${spring.data.redis.host:127.0.0.1}")
    private String host;

    @Value("${spring.data.redis.port:6379}")
    private int port;

    @Value("${spring.data.redis.password:none}")
    private String password;

    @Bean
    public RedissonClient redissonClient() {
        Config config = new Config();
        var singleServerConfig = config.useSingleServer()
                .setAddress("redis://" + host + ":" + port)
                .setConnectionMinimumIdleSize(1)
                .setConnectionPoolSize(8)
                .setIdleConnectionTimeout(10000)
                .setTimeout(3000);
        
        if (password != null && !password.isEmpty() && !"none".equalsIgnoreCase(password) && !"null".equalsIgnoreCase(password)) {
            singleServerConfig.setPassword(password);
        }
        
        return Redisson.create(config);
    }

    // AI 分析任务阻塞队列
    @Bean
    public RBlockingDeque<Long> analysisQueue(RedissonClient redisson) {
        return redisson.getBlockingDeque("queue:ai-analysis");
    }

    // 延迟队列，用于失败重试
    @Bean
    public RDelayedQueue<Long> delayedAnalysisQueue(RedissonClient redisson,
                                                     RBlockingDeque<Long> analysisQueue) {
        return redisson.getDelayedQueue(analysisQueue);
    }
}
