package com.infodigest.scheduler;

import com.infodigest.entity.User;
import com.infodigest.entity.UserPlatform;
import com.infodigest.repository.UserPlatformRepository;
import com.infodigest.repository.UserRepository;
import com.infodigest.security.JwtUtil;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CrawlSchedulerTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private UserPlatformRepository userPlatformRepository;

    @Mock
    private JwtUtil jwtUtil;

    @InjectMocks
    private CrawlScheduler crawlScheduler;

    private User createUser(Long id, String username) {
        User user = new User();
        user.setId(id);
        user.setUsername(username);
        return user;
    }

    private UserPlatform createPlatform(Long userId, String platform) {
        UserPlatform up = new UserPlatform();
        up.setUserId(userId);
        up.setPlatform(platform);
        return up;
    }

    @Test
    void scheduledCrawl_startsCrawlersForConnectedPlatforms() throws Exception {
        // Given
        // Set a dummy script path so no real node process is started
        ReflectionTestUtils.setField(crawlScheduler, "crawlerScriptPath", "dummy.js");

        User user = createUser(1L, "alice");
        when(userRepository.findAll()).thenReturn(List.of(user));

        UserPlatform bilibiliPlatform = createPlatform(1L, "bilibili");
        when(userPlatformRepository.findByUserId(1L)).thenReturn(List.of(bilibiliPlatform));

        when(jwtUtil.generateToken("alice", 1L)).thenReturn("test-token");

        // When
        crawlScheduler.scheduledCrawl();

        // Wait for async thread to start and complete
        Thread.sleep(500);

        // Then - verify the flow completed without errors
        verify(userRepository).findAll();
        verify(userPlatformRepository).findByUserId(1L);
        verify(jwtUtil).generateToken("alice", 1L);
    }

    @Test
    void scheduledCrawl_skipsWhenAlreadyRunning() {
        // Given
        // Use reflection to set running flag to true
        java.util.concurrent.atomic.AtomicBoolean running =
                (java.util.concurrent.atomic.AtomicBoolean) ReflectionTestUtils.getField(crawlScheduler, "running");
        running.set(true);

        // When
        crawlScheduler.scheduledCrawl();

        // Then
        verify(userRepository, never()).findAll();
        verify(userPlatformRepository, never()).findByUserId(anyLong());
    }

    @Test
    void scheduledCrawl_handlesNoRegisteredUsers() {
        // Given
        when(userRepository.findAll()).thenReturn(List.of());

        // When
        crawlScheduler.scheduledCrawl();

        // Then
        verify(userRepository).findAll();
        verify(userPlatformRepository, never()).findByUserId(anyLong());
        verify(jwtUtil, never()).generateToken(any(), anyLong());
    }

    @Test
    void scheduledCrawl_skipsPlatformNotConnected() throws Exception {
        // Given
        ReflectionTestUtils.setField(crawlScheduler, "crawlerScriptPath", "dummy.js");

        User user = createUser(1L, "alice");
        when(userRepository.findAll()).thenReturn(List.of(user));

        // User has no platforms connected - all PLATFORMS will be skipped
        when(userPlatformRepository.findByUserId(1L)).thenReturn(List.of());

        // When
        crawlScheduler.scheduledCrawl();

        // Wait for async thread
        Thread.sleep(500);

        // Then - no JWT token generated (no platform to crawl)
        verify(userRepository).findAll();
        verify(userPlatformRepository).findByUserId(1L);
        verify(jwtUtil, never()).generateToken(any(), anyLong());
    }

    @Test
    void scheduledCrawl_skipsAlreadyActiveJob() throws Exception {
        // Given
        ReflectionTestUtils.setField(crawlScheduler, "crawlerScriptPath", "dummy.js");

        User user = createUser(1L, "alice");
        when(userRepository.findAll()).thenReturn(List.of(user));

        UserPlatform bilibiliPlatform = createPlatform(1L, "bilibili");
        when(userPlatformRepository.findByUserId(1L)).thenReturn(List.of(bilibiliPlatform));

        // Pre-populate activeJobs so the job is skipped entirely before crawlForUser
        java.util.Set<String> activeJobs =
                (java.util.Set<String>) ReflectionTestUtils.getField(crawlScheduler, "activeJobs");
        activeJobs.add("1:bilibili");

        // When
        crawlScheduler.scheduledCrawl();

        // Wait for async thread
        Thread.sleep(500);

        // Then - active job check prevented crawlForUser from being invoked
        verify(userRepository).findAll();
        verify(userPlatformRepository).findByUserId(1L);
        // crawlForUser (which calls jwtUtil.generateToken) is never reached
        verify(jwtUtil, never()).generateToken(any(), anyLong());
    }

    @Test
    void scheduledCrawl_handlesOuterException() {
        // Given - userRepository.findAll throws to exercise the outer catch
        when(userRepository.findAll()).thenThrow(new RuntimeException("DB error"));

        // When - should not propagate exception
        crawlScheduler.scheduledCrawl();

        // Then
        verify(userRepository).findAll();
        verify(userPlatformRepository, never()).findByUserId(anyLong());
    }
}
