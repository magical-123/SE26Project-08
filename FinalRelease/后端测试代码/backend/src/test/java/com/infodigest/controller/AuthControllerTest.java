package com.infodigest.controller;

import com.infodigest.dto.AuthResponse;
import com.infodigest.dto.LoginRequest;
import com.infodigest.dto.RegisterRequest;
import com.infodigest.service.AuthService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthControllerTest {

    @Mock
    private AuthService authService;

    @InjectMocks
    private AuthController controller;

    @Test
    void login_ReturnsAuthResponse() {
        // Given
        LoginRequest request = new LoginRequest();
        request.setUsername("alice");
        request.setPassword("password123");

        AuthResponse expectedResponse = new AuthResponse("jwt-token", "alice", 1L, "avatar.png");
        when(authService.login(any(LoginRequest.class))).thenReturn(expectedResponse);

        // When
        ResponseEntity<?> response = controller.login(request);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        AuthResponse body = (AuthResponse) response.getBody();
        assertNotNull(body);
        assertEquals("jwt-token", body.getToken());
        assertEquals("alice", body.getUsername());
        assertEquals(1L, body.getUserId());
        verify(authService).login(request);
    }

    @Test
    void register_ReturnsAuthResponse() {
        // Given
        RegisterRequest request = new RegisterRequest();
        request.setUsername("bob");
        request.setEmail("bob@example.com");
        request.setPassword("securePass");

        AuthResponse expectedResponse = new AuthResponse("new-jwt-token", "bob", 2L, null);
        when(authService.register(any(RegisterRequest.class))).thenReturn(expectedResponse);

        // When
        ResponseEntity<?> response = controller.register(request);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        AuthResponse body = (AuthResponse) response.getBody();
        assertNotNull(body);
        assertEquals("new-jwt-token", body.getToken());
        assertEquals("bob", body.getUsername());
        assertEquals(2L, body.getUserId());
        verify(authService).register(request);
    }

    @Test
    void login_FailsWithWrongCredentials() {
        // Given
        LoginRequest request = new LoginRequest();
        request.setUsername("alice");
        request.setPassword("wrong-password");

        when(authService.login(any(LoginRequest.class)))
                .thenThrow(new RuntimeException("Invalid username or password"));

        // When
        ResponseEntity<?> response = controller.login(request);

        // Then
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertEquals("Invalid username or password", response.getBody());
        verify(authService).login(request);
    }

    @Test
    void register_FailsWithDuplicateUsername() {
        // Given
        RegisterRequest request = new RegisterRequest();
        request.setUsername("existing");
        request.setEmail("existing@example.com");
        request.setPassword("password");

        when(authService.register(any(RegisterRequest.class)))
                .thenThrow(new RuntimeException("Username is already taken!"));

        // When
        ResponseEntity<?> response = controller.register(request);

        // Then
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertEquals("Username is already taken!", response.getBody());
        verify(authService).register(request);
    }
}
