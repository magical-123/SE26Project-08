package com.infodigest.config;

import org.junit.jupiter.api.Test;
import org.redisson.api.RBlockingDeque;
import org.redisson.api.RDelayedQueue;
import org.redisson.api.RedissonClient;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
public class SecurityConfigBeansTest {

    @MockBean
    private RedissonClient redissonClient;

    @MockBean(name = "analysisQueue")
    private RBlockingDeque<Long> analysisQueue;

    @MockBean(name = "delayedAnalysisQueue")
    private RDelayedQueue<Long> delayedAnalysisQueue;

    @Autowired(required = false)
    private PasswordEncoder passwordEncoder;

    @Autowired(required = false)
    private CorsConfigurationSource corsConfigurationSource;

    @Test
    public void passwordEncoder_encodesAndMatches() {
        assertNotNull(passwordEncoder);
        String hash = passwordEncoder.encode("test123");
        assertTrue(passwordEncoder.matches("test123", hash));
        assertFalse(passwordEncoder.matches("wrong", hash));
    }

    @Test
    public void corsConfigurationSource_isConfigured() {
        assertNotNull(corsConfigurationSource);
        CorsConfiguration config = corsConfigurationSource.getCorsConfiguration(new MockHttpServletRequest());
        assertNotNull(config);
        assertTrue(config.getAllowedMethods().contains("GET"));
        assertTrue(config.getAllowedMethods().contains("POST"));
    }
}
