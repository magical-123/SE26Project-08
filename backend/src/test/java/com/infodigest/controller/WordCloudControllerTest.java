package com.infodigest.controller;

import com.infodigest.entity.InformationItem;
import com.infodigest.entity.UserWordCloud;
import com.infodigest.repository.InformationItemRepository;
import com.infodigest.service.WordCloudService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class WordCloudControllerTest {

    @Mock
    private WordCloudService wordCloudService;

    @Mock
    private InformationItemRepository itemRepository;

    @InjectMocks
    private WordCloudController controller;

    @SuppressWarnings("unchecked")
    @Test
    void getDailyWordCloud_ReturnsWordCloudForToday() throws Exception {
        // Given
        Map<String, Object> keyword1 = Map.of("word", "大模型架构", "weight", 100);
        Map<String, Object> keyword2 = Map.of("word", "React 19", "weight", 80);
        Map<String, Object> wordCloudData = Map.of("keywords", List.of(keyword1, keyword2));

        when(wordCloudService.getWordCloud(eq(1L), any(LocalDate.class))).thenReturn(wordCloudData);

        // When
        ResponseEntity<?> response = controller.getDailyWordCloud(1L, null);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        assertTrue((Boolean) body.get("success"));
        assertNotNull(body.get("data"));
    }

    @SuppressWarnings("unchecked")
    @Test
    void getDailyWordCloud_ReturnsNoDataWhenServiceFails() throws Exception {
        // Given
        when(wordCloudService.getWordCloud(eq(1L), any(LocalDate.class)))
                .thenThrow(new RuntimeException("Service error"));

        // When
        ResponseEntity<?> response = controller.getDailyWordCloud(1L, null);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        assertFalse((Boolean) body.get("success"));
    }

    @SuppressWarnings("unchecked")
    @Test
    void getWeeklyWordClouds_ReturnsHistoricalData() {
        // Given
        Map<String, Object> day1 = Map.of("date", "2026-07-24", "keywords", List.of());
        Map<String, Object> day2 = Map.of("date", "2026-07-25", "keywords", List.of());
        List<Map<String, Object>> weeklyData = List.of(day1, day2);

        when(wordCloudService.getWeeklyWordClouds(eq(1L), any(LocalDate.class))).thenReturn(weeklyData);

        // When
        ResponseEntity<?> response = controller.getWeeklyWordClouds(1L, null);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        assertTrue((Boolean) body.get("success"));
        assertNotNull(body.get("data"));
    }

    @Test
    void generateWordCloud_GeneratesSuccessfully() throws Exception {
        // Given
        UserWordCloud userWordCloud = new UserWordCloud();
        userWordCloud.setUserId(1L);
        userWordCloud.setReportDate(LocalDate.now());
        userWordCloud.setKeywords("[{\"word\":\"AI\",\"weight\":90}]");
        when(wordCloudService.generateWordCloud(eq(1L), any(LocalDate.class))).thenReturn(userWordCloud);

        // When
        ResponseEntity<?> response = controller.generateWordCloud(1L, null);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        assertTrue((Boolean) body.get("success"));
        assertEquals("词云生成成功", body.get("message"));
    }

    @SuppressWarnings("unchecked")
    @Test
    void getAnalyzedVideoDates_ReturnsDates() {
        // Given
        InformationItem item1 = new InformationItem();
        item1.setId(1L);
        item1.setUserId(1L);
        item1.setProcessStatus("ANALYZED");
        item1.setCrawledAt(LocalDateTime.now());
        item1.setAnalyzedAt(LocalDateTime.now());

        when(itemRepository.findByUserIdAndProcessStatus(1L, "ANALYZED"))
                .thenReturn(List.of(item1));

        // When
        ResponseEntity<?> response = controller.getAnalyzedVideoDates(1L);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        assertTrue((Boolean) body.get("success"));
        assertEquals(1, body.get("totalCount"));
    }

    @SuppressWarnings("unchecked")
    @Test
    void getAnalyzedVideoDates_EmptyItems() {
        // Given
        when(itemRepository.findByUserIdAndProcessStatus(1L, "ANALYZED"))
                .thenReturn(List.of());

        // When
        ResponseEntity<?> response = controller.getAnalyzedVideoDates(1L);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        assertTrue((Boolean) body.get("success"));
        assertEquals(0, body.get("count"));
    }

    @SuppressWarnings("unchecked")
    @Test
    void generateWordCloud_Fails() throws Exception {
        // Given
        when(wordCloudService.generateWordCloud(eq(1L), any(LocalDate.class)))
                .thenThrow(new RuntimeException("Generation failed"));

        // When
        ResponseEntity<?> response = controller.generateWordCloud(1L, null);

        // Then
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        assertFalse((Boolean) body.get("success"));
    }

    @SuppressWarnings("unchecked")
    @Test
    void getWeeklyWordClouds_Fails() {
        // Given
        when(wordCloudService.getWeeklyWordClouds(eq(1L), any(LocalDate.class)))
                .thenThrow(new RuntimeException("Service error"));

        // When
        ResponseEntity<?> response = controller.getWeeklyWordClouds(1L, null);

        // Then
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        assertFalse((Boolean) body.get("success"));
    }
}
