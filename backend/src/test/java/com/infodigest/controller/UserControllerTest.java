package com.infodigest.controller;

import com.infodigest.entity.User;
import com.infodigest.entity.Visibility;
import com.infodigest.repository.UserRepository;
import com.infodigest.security.JwtUtil;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserControllerTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private JwtUtil jwtUtil;

    @InjectMocks
    private UserController controller;

    private User createTestUser(Long id, String username, String email) {
        User user = new User();
        user.setId(id);
        user.setUsername(username);
        user.setEmail(email);
        user.setPasswordHash("hashed-password");
        user.setDefaultVisibility(Visibility.PUBLIC);
        user.setCreatedAt(LocalDateTime.now());
        user.setAvatarUrl("https://example.com/avatar.png");
        user.setHiddenPlatforms("[]");
        user.setSelfPortrait("A curious learner");
        return user;
    }

    @Test
    void getProfile_ReturnsUserProfile() {
        // Given
        String authHeader = "Bearer valid-jwt-token";
        User user = createTestUser(1L, "alice", "alice@example.com");
        when(jwtUtil.extractUserId("valid-jwt-token")).thenReturn(1L);
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));

        // When
        ResponseEntity<?> response = controller.getProfile(authHeader);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        assertEquals(1L, body.get("id"));
        assertEquals("alice", body.get("username"));
        assertEquals("alice@example.com", body.get("email"));
        assertEquals("https://example.com/avatar.png", body.get("avatarUrl"));
        assertEquals("PUBLIC", body.get("defaultVisibility"));
        verify(jwtUtil).extractUserId("valid-jwt-token");
        verify(userRepository).findById(1L);
    }

    @Test
    void getProfile_Returns400ForNonexistentUser() {
        // Given
        String authHeader = "Bearer invalid-token";
        when(jwtUtil.extractUserId("invalid-token")).thenReturn(999L);
        when(userRepository.findById(999L)).thenReturn(Optional.empty());

        // When
        ResponseEntity<?> response = controller.getProfile(authHeader);

        // Then
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertTrue(response.getBody() instanceof String);
        assertTrue(((String) response.getBody()).contains("User not found"));
    }

    @Test
    void updateProfile_Succeeds() {
        // Given
        String authHeader = "Bearer valid-jwt-token";
        User user = createTestUser(1L, "alice", "alice@example.com");
        when(jwtUtil.extractUserId("valid-jwt-token")).thenReturn(1L);
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Map<String, String> body = Map.of(
                "username", "alice_updated",
                "email", "alice_new@example.com"
        );

        // When
        ResponseEntity<?> response = controller.updateProfile(authHeader, body);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        @SuppressWarnings("unchecked")
        Map<String, Object> result = (Map<String, Object>) response.getBody();
        assertNotNull(result);
        assertEquals("alice_updated", result.get("username"));
        assertEquals("alice_new@example.com", result.get("email"));
        assertEquals("Profile updated successfully", result.get("message"));
        verify(userRepository).save(any(User.class));
    }

    @Test
    void updateProfile_ReturnsBadRequestForEmptyUsername() {
        // Given
        String authHeader = "Bearer valid-jwt-token";
        User user = createTestUser(1L, "alice", "alice@example.com");
        when(jwtUtil.extractUserId("valid-jwt-token")).thenReturn(1L);
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));

        Map<String, String> body = Map.of("username", "");

        // When
        ResponseEntity<?> response = controller.updateProfile(authHeader, body);

        // Then
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertEquals("Username cannot be empty", response.getBody());
        verify(userRepository, never()).save(any());
    }

    @Test
    void updateProfile_ReturnsBadRequestForDuplicateUsername() {
        // Given
        String authHeader = "Bearer valid-jwt-token";
        User user = createTestUser(1L, "alice", "alice@example.com");
        when(jwtUtil.extractUserId("valid-jwt-token")).thenReturn(1L);
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));

        User existingUser = new User();
        existingUser.setUsername("bob");
        when(userRepository.findByUsername("bob")).thenReturn(Optional.of(existingUser));

        Map<String, String> body = Map.of("username", "bob");

        // When
        ResponseEntity<?> response = controller.updateProfile(authHeader, body);

        // Then
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertEquals("Username is already taken!", response.getBody());
        verify(userRepository, never()).save(any());
    }

    @Test
    void updateProfile_UpdatesSelfPortrait() {
        // Given
        String authHeader = "Bearer valid-jwt-token";
        User user = createTestUser(1L, "alice", "alice@example.com");
        when(jwtUtil.extractUserId("valid-jwt-token")).thenReturn(1L);
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Map<String, String> body = Map.of("selfPortrait", "Updated self portrait text");

        // When
        ResponseEntity<?> response = controller.updateProfile(authHeader, body);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("Updated self portrait text", user.getSelfPortrait());
        verify(userRepository).save(user);
    }

    @Test
    void getProfile_Fails_TokenInvalid() {
        // Given
        String authHeader = "Bearer invalid-token";
        when(jwtUtil.extractUserId("invalid-token")).thenThrow(new RuntimeException("Invalid token"));

        // When
        ResponseEntity<?> response = controller.getProfile(authHeader);

        // Then
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertTrue(response.getBody() instanceof String);
    }

    @SuppressWarnings("unchecked")
    @Test
    void updateProfile_UpdatesEmail() {
        // Given
        String authHeader = "Bearer valid-jwt-token";
        User user = createTestUser(1L, "alice", "alice@example.com");
        when(jwtUtil.extractUserId("valid-jwt-token")).thenReturn(1L);
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        lenient().when(userRepository.findByEmail(anyString())).thenReturn(Optional.empty());
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Map<String, String> body = Map.of("email", "newemail@example.com");

        // When
        ResponseEntity<?> response = controller.updateProfile(authHeader, body);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> result = (Map<String, Object>) response.getBody();
        assertNotNull(result);
        assertEquals("newemail@example.com", result.get("email"));
        verify(userRepository).save(any(User.class));
    }

    @SuppressWarnings("unchecked")
    @Test
    void updateProfile_EmailTaken() {
        // Given
        String authHeader = "Bearer valid-jwt-token";
        User user = createTestUser(1L, "alice", "alice@example.com");
        when(jwtUtil.extractUserId("valid-jwt-token")).thenReturn(1L);
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));

        User existingUser = new User();
        existingUser.setEmail("taken@example.com");
        when(userRepository.findByEmail("taken@example.com")).thenReturn(Optional.of(existingUser));

        Map<String, String> body = Map.of("email", "taken@example.com");

        // When
        ResponseEntity<?> response = controller.updateProfile(authHeader, body);

        // Then
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertEquals("Email is already taken!", response.getBody());
        verify(userRepository, never()).save(any());
    }

    @SuppressWarnings("unchecked")
    @Test
    void updatePrivacy_SetsPublic() {
        // Given
        String authHeader = "Bearer valid-jwt-token";
        User user = createTestUser(1L, "alice", "alice@example.com");
        when(jwtUtil.extractUserId("valid-jwt-token")).thenReturn(1L);
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Map<String, Object> body = Map.of("publicGraph", true);

        // When
        ResponseEntity<?> response = controller.updatePrivacy(authHeader, body);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> result = (Map<String, Object>) response.getBody();
        assertNotNull(result);
        assertTrue((Boolean) result.get("publicGraph"));
        assertEquals("PUBLIC", result.get("defaultVisibility"));
    }

    @Test
    void updatePrivacy_InvalidBoolean() {
        // Given
        String authHeader = "Bearer valid-jwt-token";
        User user = createTestUser(1L, "alice", "alice@example.com");
        when(jwtUtil.extractUserId("valid-jwt-token")).thenReturn(1L);
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));

        Map<String, Object> body = Map.of("publicGraph", "not-a-boolean");

        // When
        ResponseEntity<?> response = controller.updatePrivacy(authHeader, body);

        // Then
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertEquals("publicGraph must be a boolean", response.getBody());
    }

    @SuppressWarnings("unchecked")
    @Test
    void updateAvatar_Succeeds() {
        // Given
        String authHeader = "Bearer valid-jwt-token";
        User user = createTestUser(1L, "alice", "alice@example.com");
        when(jwtUtil.extractUserId("valid-jwt-token")).thenReturn(1L);
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Map<String, String> body = Map.of("avatarUrl", "https://example.com/new-avatar.png");

        // When
        ResponseEntity<?> response = controller.updateAvatar(authHeader, body);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> result = (Map<String, Object>) response.getBody();
        assertNotNull(result);
        assertEquals("https://example.com/new-avatar.png", result.get("avatarUrl"));
        assertEquals("Avatar updated successfully", result.get("message"));
    }

    @Test
    void updateAvatar_MissingUrl() {
        // Given
        String authHeader = "Bearer valid-jwt-token";
        User user = createTestUser(1L, "alice", "alice@example.com");
        when(jwtUtil.extractUserId("valid-jwt-token")).thenReturn(1L);
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));

        Map<String, String> body = Map.of();

        // When
        ResponseEntity<?> response = controller.updateAvatar(authHeader, body);

        // Then
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertEquals("avatarUrl is required", response.getBody());
    }
}
