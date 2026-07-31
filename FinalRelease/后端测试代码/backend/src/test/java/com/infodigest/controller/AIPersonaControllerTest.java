package com.infodigest.controller;

import com.infodigest.entity.User;
import com.infodigest.repository.UserRepository;
import com.infodigest.service.AIPersonaService;
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

import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AIPersonaControllerTest {

    @Mock
    private AIPersonaService aiPersonaService;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private AIPersonaController controller;

    private final User currentUser = new User();

    @BeforeEach
    void setUp() {
        currentUser.setId(1L);
        currentUser.setUsername("testuser");
        when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(currentUser));
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("testuser", null));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void getAIPersona_ReturnsPersona() {
        // Given
        Map<String, Object> persona = Map.of(
                "personaTitle", "系统边界的探索者",
                "coreTraits", java.util.List.of("#硬核求知"));
        when(aiPersonaService.generatePersona(1L, false)).thenReturn(persona);

        // When
        ResponseEntity<?> response = controller.getAIPersona(false);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        assertTrue((Boolean) body.get("success"));
        assertEquals(persona, body.get("data"));
        verify(aiPersonaService, times(1)).generatePersona(1L, false);
    }

    @Test
    void getAIPersona_WithForceRefresh_PassesFlag() {
        // Given
        when(aiPersonaService.generatePersona(1L, true)).thenReturn(Map.of());

        // When
        ResponseEntity<?> response = controller.getAIPersona(true);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        verify(aiPersonaService, times(1)).generatePersona(1L, true);
    }

    @Test
    void getAIPersona_WhenUserNotFound_ReturnsBadRequest() {
        // Given
        when(userRepository.findByUsername("testuser")).thenReturn(Optional.empty());

        // When
        ResponseEntity<?> response = controller.getAIPersona(false);

        // Then
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        assertFalse((Boolean) body.get("success"));
        verify(aiPersonaService, never()).generatePersona(anyLong(), anyBoolean());
    }

    @Test
    void getAIPersona_WhenServiceThrows_ReturnsBadRequest() {
        // Given
        when(aiPersonaService.generatePersona(1L, false))
                .thenThrow(new RuntimeException("无足够的优质信息源"));

        // When
        ResponseEntity<?> response = controller.getAIPersona(false);

        // Then
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        assertFalse((Boolean) body.get("success"));
        assertTrue(((String) body.get("error")).contains("无足够的优质信息源"));
    }
}
