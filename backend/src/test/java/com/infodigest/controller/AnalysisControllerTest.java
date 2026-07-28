package com.infodigest.controller;

import com.infodigest.repository.InformationItemRepository;
import com.infodigest.repository.UserRepository;
import com.infodigest.scheduler.ContentAnalysisScheduler;
import com.infodigest.entity.User;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.*;

class AnalysisControllerTest {
    private InformationItemRepository items;
    private UserRepository users;
    private AnalysisController controller;

    @BeforeEach
    void setUp() {
        items = mock(InformationItemRepository.class);
        users = mock(UserRepository.class);
        controller = new AnalysisController();
        ReflectionTestUtils.setField(controller, "itemRepository", items);
        ReflectionTestUtils.setField(controller, "userRepository", users);
        ReflectionTestUtils.setField(controller, "analysisScheduler", mock(ContentAnalysisScheduler.class));
        User current = new User();
        current.setId(1L);
        current.setUsername("alice");
        when(users.findByUsername("alice")).thenReturn(Optional.of(current));
        SecurityContextHolder.getContext().setAuthentication(
                UsernamePasswordAuthenticationToken.authenticated("alice", null, java.util.List.of()));
    }

    @AfterEach
    void tearDown() { SecurityContextHolder.clearContext(); }

    @Test
    void rejectsNutritionStatsForAnotherUser() {
        assertEquals(403, controller.getNutritionStats(2L).getStatusCode().value());
        verify(items, never()).findByUserIdAndProcessStatus(anyLong(), anyString());
    }

    @Test
    void returnsEmptyStatsForCurrentUserWithoutItems() {
        when(items.findByUserIdAndProcessStatus(1L, "PROCESSED")).thenReturn(java.util.List.of());
        assertEquals(200, controller.getNutritionStats(1L).getStatusCode().value());
    }
}
