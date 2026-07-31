package com.infodigest.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.infodigest.entity.User;
import com.infodigest.repository.UserRepository;
import com.infodigest.testutil.TestTokenHelper;
import org.junit.jupiter.api.BeforeEach;
import org.mockito.Mockito;
import org.redisson.api.RBlockingDeque;
import org.redisson.api.RDelayedQueue;
import org.redisson.api.RedissonClient;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;

import java.util.concurrent.TimeUnit;

/**
 * 集成测试基类。
 * <p>
 * 自动配置 Spring Boot 测试上下文，使用 H2 内存数据库（MySQL 兼容模式）。
 * Mock Redis/Redisson 依赖，避免测试时需要 Redis 服务。
 * 提供公共的测试用户创建和 JWT Token 生成能力。
 */
@SpringBootTest
@AutoConfigureMockMvc
public abstract class BaseIntegrationTest {

    @Autowired
    protected MockMvc mockMvc;

    @Autowired
    protected ObjectMapper objectMapper;

    @Autowired
    protected UserRepository userRepository;

    @Autowired
    protected PasswordEncoder passwordEncoder;

    @Autowired
    protected TestTokenHelper tokenHelper;

    /** 模拟 Redisson 客户端，避免连接真实 Redis */
    @MockBean
    protected RedissonClient redissonClient;

    /** 模拟分析队列（被 AnalysisQueueConsumer 和 InboxController 注入） */
    @MockBean(name = "analysisQueue")
    protected RBlockingDeque<Long> analysisQueue;

    /** 模拟延迟队列 */
    @MockBean(name = "delayedAnalysisQueue")
    protected RDelayedQueue<Long> delayedAnalysisQueue;

    protected String testUsername = "testuser";
    protected String testPassword = "testpass123";
    protected String testEmail = "test@example.com";
    protected Long testUserId;
    protected String testToken;

    @BeforeEach
    public void setUpBase() throws Exception {
        userRepository.deleteAll();

        User user = new User();
        user.setUsername(testUsername);
        user.setPasswordHash(passwordEncoder.encode(testPassword));
        user.setEmail(testEmail);
        user = userRepository.save(user);
        testUserId = user.getId();
        testToken = tokenHelper.createToken(testUsername, testUserId);
    }
}
