package com.infodigest.controller;

import com.infodigest.repository.InformationItemRepository;
import com.infodigest.repository.UserRepository;
import com.infodigest.scheduler.ContentAnalysisScheduler;
import com.infodigest.entity.User;
import com.infodigest.entity.InformationItem;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;
import java.util.List;
import java.time.LocalDateTime;

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

    @Test
    void coversTriggerStatusResultAndStatsPaths() {
        ContentAnalysisScheduler scheduler = mock(ContentAnalysisScheduler.class);
        ReflectionTestUtils.setField(controller, "analysisScheduler", scheduler);
        InformationItem pending = new InformationItem();
        pending.setId(3L); pending.setTitle("title"); pending.setPlatform("BILIBILI");
        pending.setProcessStatus("UNPROCESSED");
        pending.setNutritionProtein(40); pending.setNutritionCarbs(20);
        pending.setNutritionVitamins(10); pending.setNutritionFats(20); pending.setNutritionFiber(10);
        pending.setAnalyzedAt(LocalDateTime.now());
        when(items.findById(3L)).thenReturn(Optional.of(pending));
        assertEquals(200, controller.triggerAnalysis(3L).getStatusCode().value());
        verify(scheduler).analyzeItemAsync(3L);
        assertEquals(200, controller.getAnalysisStatus(3L).getStatusCode().value());
        assertEquals(200, controller.getAnalysisResult(3L).getStatusCode().value());

        pending.setProcessStatus("PROCESSED");
        assertEquals(200, controller.triggerAnalysis(3L).getStatusCode().value());
        when(items.findById(99L)).thenReturn(Optional.empty());
        assertEquals(400, controller.triggerAnalysis(99L).getStatusCode().value());
        assertEquals(400, controller.getAnalysisStatus(99L).getStatusCode().value());
        assertEquals(400, controller.getAnalysisResult(99L).getStatusCode().value());

        when(items.count()).thenReturn(4L);
        when(items.findByProcessStatus(anyString(), isNull())).thenReturn(List.of(pending));
        assertEquals(200, controller.getAnalysisStats().getStatusCode().value());
        when(items.count()).thenThrow(new IllegalStateException("db"));
        assertEquals(400, controller.getAnalysisStats().getStatusCode().value());
    }

    @Test
    void calculatesNormalizedNutritionAndHandlesUnauthorizedAndFailure() {
        InformationItem one = new InformationItem();
        one.setNutritionProtein(50); one.setNutritionCarbs(20); one.setNutritionVitamins(10);
        one.setNutritionFats(10); one.setNutritionFiber(10);
        InformationItem two = new InformationItem();
        two.setNutritionProtein(30); two.setNutritionCarbs(30); two.setNutritionVitamins(20);
        two.setNutritionFats(10); two.setNutritionFiber(10);
        when(items.findByUserIdAndProcessStatus(1L, "PROCESSED")).thenReturn(List.of(one, two));
        assertEquals(200, controller.getNutritionStats(1L).getStatusCode().value());

        SecurityContextHolder.clearContext();
        assertEquals(401, controller.getNutritionStats(1L).getStatusCode().value());
        SecurityContextHolder.getContext().setAuthentication(
                UsernamePasswordAuthenticationToken.authenticated("alice", null, List.of()));
        when(items.findByUserIdAndProcessStatus(1L, "PROCESSED"))
                .thenThrow(new IllegalStateException("db"));
        assertEquals(400, controller.getNutritionStats(1L).getStatusCode().value());
    }
}
