package com.infodigest.dto;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class DtoTests {

    // --- AnalysisResultDTO tests ---

    @Test
    void analysisResultDTO_gettersAndSetters() {
        AnalysisResultDTO dto = new AnalysisResultDTO();

        dto.setProtein(50);
        dto.setCarbs(30);
        dto.setVitamins(10);
        dto.setFats(5);
        dto.setFiber(5);
        dto.setReasoning("Good reasoning");
        dto.setSummary("A summary");

        assertEquals(50, dto.getProtein());
        assertEquals(30, dto.getCarbs());
        assertEquals(10, dto.getVitamins());
        assertEquals(5, dto.getFats());
        assertEquals(5, dto.getFiber());
        assertEquals("Good reasoning", dto.getReasoning());
        assertEquals("A summary", dto.getSummary());
    }

    @Test
    void analysisResultDTO_allArgsConstructor() {
        AnalysisResultDTO.QuoteItem qi = new AnalysisResultDTO.QuoteItem("Quote text", "Quote reason");
        List<AnalysisResultDTO.QuoteItem> quotes = List.of(qi);

        AnalysisResultDTO dto = new AnalysisResultDTO(40, 20, 15, 15, 10,
                "Test reasoning", "Test summary", quotes);

        assertEquals(40, dto.getProtein());
        assertEquals(20, dto.getCarbs());
        assertEquals(15, dto.getVitamins());
        assertEquals(15, dto.getFats());
        assertEquals(10, dto.getFiber());
        assertEquals("Test reasoning", dto.getReasoning());
        assertEquals("Test summary", dto.getSummary());
        assertNotNull(dto.getQuotes());
        assertEquals(1, dto.getQuotes().size());
    }

    @Test
    void analysisResultDTO_noArgsConstructor() {
        AnalysisResultDTO dto = new AnalysisResultDTO();
        assertNull(dto.getProtein());
        assertNull(dto.getCarbs());
        assertNull(dto.getVitamins());
        assertNull(dto.getFats());
        assertNull(dto.getFiber());
        assertNull(dto.getReasoning());
        assertNull(dto.getSummary());
        assertNull(dto.getQuotes());
    }

    @Test
    void analysisResultDTO_quoteItem_gettersAndSetters() {
        AnalysisResultDTO.QuoteItem qi = new AnalysisResultDTO.QuoteItem();

        qi.setText("Great quote");
        qi.setReason("Reason why");

        assertEquals("Great quote", qi.getText());
        assertEquals("Reason why", qi.getReason());
    }

    @Test
    void analysisResultDTO_quoteItem_allArgsConstructor() {
        AnalysisResultDTO.QuoteItem qi = new AnalysisResultDTO.QuoteItem("Quote text", "Quote reason");

        assertEquals("Quote text", qi.getText());
        assertEquals("Quote reason", qi.getReason());
    }

    @Test
    void analysisResultDTO_quoteItem_noArgsConstructor() {
        AnalysisResultDTO.QuoteItem qi = new AnalysisResultDTO.QuoteItem();
        assertNull(qi.getText());
        assertNull(qi.getReason());
    }

    // --- AnalysisResponse tests ---

    @Test
    void analysisResponse_gettersAndSetters() {
        AnalysisResponse response = new AnalysisResponse();

        response.setItemId(1L);
        response.setKnowledgeScore(85);
        response.setScoreReasoning("Deep content");
        response.setAiSummary("Summary text");
        response.setStatus("SUCCESS");
        response.setMessage("Analysis complete");

        assertEquals(1L, response.getItemId());
        assertEquals(85, response.getKnowledgeScore());
        assertEquals("Deep content", response.getScoreReasoning());
        assertEquals("Summary text", response.getAiSummary());
        assertEquals("SUCCESS", response.getStatus());
        assertEquals("Analysis complete", response.getMessage());
    }

    @Test
    void analysisResponse_allArgsConstructor() {
        AnalysisResponse response = new AnalysisResponse(2L, 90, "Great reasoning",
                "AI summary", "SUCCESS", "Done");

        assertEquals(2L, response.getItemId());
        assertEquals(90, response.getKnowledgeScore());
        assertEquals("Great reasoning", response.getScoreReasoning());
        assertEquals("AI summary", response.getAiSummary());
        assertEquals("SUCCESS", response.getStatus());
        assertEquals("Done", response.getMessage());
    }

    @Test
    void analysisResponse_noArgsConstructor() {
        AnalysisResponse response = new AnalysisResponse();
        assertNull(response.getItemId());
        assertNull(response.getKnowledgeScore());
        assertNull(response.getScoreReasoning());
        assertNull(response.getAiSummary());
        assertNull(response.getStatus());
        assertNull(response.getMessage());
    }

    // --- AuthResponse tests ---

    @Test
    void authResponse_gettersAndSetters() {
        AuthResponse response = new AuthResponse();

        response.setToken("jwt-token");
        response.setUsername("testuser");
        response.setUserId(42L);
        response.setAvatarUrl("https://example.com/avatar.png");

        assertEquals("jwt-token", response.getToken());
        assertEquals("testuser", response.getUsername());
        assertEquals(42L, response.getUserId());
        assertEquals("https://example.com/avatar.png", response.getAvatarUrl());
    }

    @Test
    void authResponse_allArgsConstructor() {
        AuthResponse response = new AuthResponse("token123", "alice", 7L, "http://avatar.url");

        assertEquals("token123", response.getToken());
        assertEquals("alice", response.getUsername());
        assertEquals(7L, response.getUserId());
        assertEquals("http://avatar.url", response.getAvatarUrl());
    }

    @Test
    void authResponse_noArgsConstructor() {
        AuthResponse response = new AuthResponse();
        assertNull(response.getToken());
        assertNull(response.getUsername());
        assertNull(response.getUserId());
        assertNull(response.getAvatarUrl());
    }

    // --- LoginRequest tests ---

    @Test
    void loginRequest_gettersAndSetters() {
        LoginRequest request = new LoginRequest();

        request.setUsername("loginuser");
        request.setPassword("secret123");

        assertEquals("loginuser", request.getUsername());
        assertEquals("secret123", request.getPassword());
    }

    // --- RegisterRequest tests ---

    @Test
    void registerRequest_gettersAndSetters() {
        RegisterRequest request = new RegisterRequest();

        request.setUsername("newuser");
        request.setEmail("new@example.com");
        request.setPassword("password456");

        assertEquals("newuser", request.getUsername());
        assertEquals("new@example.com", request.getEmail());
        assertEquals("password456", request.getPassword());
    }
}
