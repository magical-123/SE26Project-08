package com.infodigest.security;

import com.infodigest.entity.User;
import com.infodigest.repository.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserActivityFilterTest {

    @Mock
    private HttpServletRequest request;
    @Mock
    private HttpServletResponse response;
    @Mock
    private FilterChain filterChain;
    @Mock
    private UserRepository userRepository;
    @Mock
    private Authentication authentication;

    private UserActivityFilter filter;

    @BeforeEach
    void setUp() {
        filter = new UserActivityFilter(userRepository);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void doFilterInternal_withApiRequestAndAuthenticatedUser_updatesLastActiveAt() throws Exception {
        String username = "testuser";
        User user = new User();
        user.setUsername(username);
        user.setLastActiveAt(LocalDateTime.now().minusMinutes(10));

        when(request.getRequestURI()).thenReturn("/api/dashboard");
        SecurityContextHolder.getContext().setAuthentication(authentication);
        when(authentication.isAuthenticated()).thenReturn(true);
        when(authentication.getName()).thenReturn(username);
        when(authentication.getPrincipal()).thenReturn(username);
        when(userRepository.findByUsername(username)).thenReturn(Optional.of(user));

        filter.doFilterInternal(request, response, filterChain);

        verify(userRepository).findByUsername(username);
        verify(userRepository).save(user);
        verify(filterChain).doFilter(request, response);
    }

    @Test
    void doFilterInternal_withNonApiPath_skipsUpdate() throws Exception {
        when(request.getRequestURI()).thenReturn("/static/style.css");

        filter.doFilterInternal(request, response, filterChain);

        verify(userRepository, never()).findByUsername(any());
        verify(userRepository, never()).save(any());
        verify(filterChain).doFilter(request, response);
    }

    @Test
    void doFilterInternal_withRecentLastActiveAt_skipsUpdate() throws Exception {
        String username = "testuser";
        User user = new User();
        user.setUsername(username);
        user.setLastActiveAt(LocalDateTime.now().minusMinutes(1)); // within 2 minutes

        when(request.getRequestURI()).thenReturn("/api/dashboard");
        SecurityContextHolder.getContext().setAuthentication(authentication);
        when(authentication.isAuthenticated()).thenReturn(true);
        when(authentication.getName()).thenReturn(username);
        when(authentication.getPrincipal()).thenReturn(username);
        when(userRepository.findByUsername(username)).thenReturn(Optional.of(user));

        filter.doFilterInternal(request, response, filterChain);

        verify(userRepository).findByUsername(username);
        verify(userRepository, never()).save(user);
        verify(filterChain).doFilter(request, response);
    }

    @Test
    void doFilterInternal_withUnauthenticatedRequest_skipsUpdate() throws Exception {
        when(request.getRequestURI()).thenReturn("/api/dashboard");
        SecurityContextHolder.getContext().setAuthentication(authentication);
        when(authentication.isAuthenticated()).thenReturn(false);

        filter.doFilterInternal(request, response, filterChain);

        verify(userRepository, never()).findByUsername(any());
        verify(userRepository, never()).save(any());
        verify(filterChain).doFilter(request, response);
    }
}
