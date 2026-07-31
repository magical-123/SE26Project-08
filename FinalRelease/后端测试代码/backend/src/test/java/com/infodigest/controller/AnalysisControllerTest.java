package com.infodigest.controller;

import com.infodigest.dto.AnalysisResponse;
import com.infodigest.entity.InformationItem;
import com.infodigest.entity.User;
import com.infodigest.repository.InformationItemRepository;
import com.infodigest.repository.UserRepository;
import com.infodigest.scheduler.ContentAnalysisScheduler;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AnalysisControllerTest {

    @Mock
    private InformationItemRepository itemRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private ContentAnalysisScheduler analysisScheduler;

    @InjectMocks
    private AnalysisController controller;

    @BeforeEach
    void setUp() {
        User currentUser = new User();
        currentUser.setId(1L);
        currentUser.setUsername("testuser");
        lenient().when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(currentUser));
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("testuser", null, java.util.List.of()));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void triggerAnalysis_StartsAnalysisForItem() {
        InformationItem item = new InformationItem();
        item.setId(100L);
        item.setProcessStatus("UNPROCESSED");

        when(itemRepository.findById(100L)).thenReturn(Optional.of(item));
        doNothing().when(analysisScheduler).analyzeItemAsync(100L);

        ResponseEntity<?> response = controller.triggerAnalysis(100L);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        AnalysisResponse body = (AnalysisResponse) response.getBody();
        assertNotNull(body);
        assertEquals("TRIGGERED", body.getStatus());
        verify(analysisScheduler).analyzeItemAsync(100L);
    }

    @Test
    void triggerAnalysis_ReturnsAlreadyProcessed() {
        InformationItem item = new InformationItem();
        item.setId(100L);
        item.setProcessStatus("PROCESSED");

        when(itemRepository.findById(100L)).thenReturn(Optional.of(item));

        ResponseEntity<?> response = controller.triggerAnalysis(100L);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        AnalysisResponse body = (AnalysisResponse) response.getBody();
        assertNotNull(body);
        assertEquals("ALREADY_PROCESSED", body.getStatus());
        verify(analysisScheduler, never()).analyzeItemAsync(anyLong());
    }

    @Test
    void triggerAnalysis_ReturnsErrorWhenItemNotFound() {
        when(itemRepository.findById(999L)).thenReturn(Optional.empty());

        ResponseEntity<?> response = controller.triggerAnalysis(999L);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
    }

    @Test
    void getAnalysisStatus_ReturnsItemStatus() {
        InformationItem item = new InformationItem();
        item.setId(100L);
        item.setTitle("\u6d4b\u8bd5\u6587\u7ae0");
        item.setProcessStatus("PROCESSED");

        when(itemRepository.findById(100L)).thenReturn(Optional.of(item));

        ResponseEntity<?> response = controller.getAnalysisStatus(100L);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        assertEquals(100L, body.get("itemId"));
        assertEquals("PROCESSED", body.get("processStatus"));
        assertEquals("\u6d4b\u8bd5\u6587\u7ae0", body.get("title"));
    }

    @Test
    void getAnalysisStatus_ReturnsErrorWhenItemNotFound() {
        when(itemRepository.findById(999L)).thenReturn(Optional.empty());

        ResponseEntity<?> response = controller.getAnalysisStatus(999L);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
    }

    @SuppressWarnings("unchecked")
    @Test
    void getNutritionStats_ReturnsEmptyStatsForUserWithoutItems() {
        when(itemRepository.findByUserIdAndProcessStatus(1L, "PROCESSED")).thenReturn(java.util.Collections.emptyList());

        ResponseEntity<?> response = controller.getNutritionStats(1L);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        assertEquals(0, body.get("count"));
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
        when(itemRepository.findById(3L)).thenReturn(Optional.of(pending));
        assertEquals(200, controller.triggerAnalysis(3L).getStatusCode().value());
        verify(scheduler).analyzeItemAsync(3L);
        assertEquals(200, controller.getAnalysisStatus(3L).getStatusCode().value());
        assertEquals(200, controller.getAnalysisResult(3L).getStatusCode().value());

        pending.setProcessStatus("PROCESSED");
        assertEquals(200, controller.triggerAnalysis(3L).getStatusCode().value());
        when(itemRepository.findById(99L)).thenReturn(Optional.empty());
        assertEquals(400, controller.triggerAnalysis(99L).getStatusCode().value());
        assertEquals(400, controller.getAnalysisStatus(99L).getStatusCode().value());
        assertEquals(400, controller.getAnalysisResult(99L).getStatusCode().value());

        when(itemRepository.count()).thenReturn(4L);
        when(itemRepository.findByProcessStatus(anyString(), isNull())).thenReturn(List.of(pending));
        assertEquals(200, controller.getAnalysisStats().getStatusCode().value());
        when(itemRepository.count()).thenThrow(new IllegalStateException("db"));
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
        when(itemRepository.findByUserIdAndProcessStatus(1L, "PROCESSED")).thenReturn(List.of(one, two));
        assertEquals(200, controller.getNutritionStats(1L).getStatusCode().value());

        SecurityContextHolder.clearContext();
        assertEquals(401, controller.getNutritionStats(1L).getStatusCode().value());
        SecurityContextHolder.getContext().setAuthentication(
                UsernamePasswordAuthenticationToken.authenticated("alice", null, List.of()));
        lenient().when(itemRepository.findByUserIdAndProcessStatus(1L, "PROCESSED"))
                .thenThrow(new IllegalStateException("db"));
        assertEquals(400, controller.getNutritionStats(1L).getStatusCode().value());
    }
}
