package com.infodigest.controller;

import com.infodigest.entity.Friendship;
import com.infodigest.entity.FriendshipStatus;
import com.infodigest.entity.InformationItem;
import com.infodigest.entity.User;
import com.infodigest.entity.Visibility;
import com.infodigest.repository.FriendshipRepository;
import com.infodigest.repository.InformationItemRepository;
import com.infodigest.repository.UserRepository;
import com.infodigest.service.WordCloudService;
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

import java.time.LocalDate;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SocialReportControllerTest {

    @Mock
    private FriendshipRepository friendshipRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private InformationItemRepository informationItemRepository;

    @Mock
    private WordCloudService wordCloudService;

    @InjectMocks
    private SocialReportController controller;

    private final User currentUser = new User();

    @BeforeEach
    void setUp() {
        currentUser.setId(1L);
        currentUser.setUsername("alice");
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(currentUser));
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("alice", null, java.util.List.of()));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @SuppressWarnings("unchecked")
    @Test
    void getFriendNutrition_ReturnsReport() {
        // Given
        Friendship accepted = new Friendship();
        accepted.setId(1L);
        accepted.setRequesterId(1L);
        accepted.setReceiverId(2L);
        accepted.setStatus(FriendshipStatus.ACCEPTED);

        User friendUser = new User();
        friendUser.setId(2L);
        friendUser.setUsername("bob");
        friendUser.setDefaultVisibility(Visibility.PUBLIC);

        InformationItem item = new InformationItem();
        item.setId(10L);
        item.setUserId(2L);
        item.setProcessStatus("PROCESSED");
        item.setNutritionProtein(40);
        item.setNutritionCarbs(30);
        item.setNutritionVitamins(20);
        item.setNutritionFats(5);
        item.setNutritionFiber(5);

        when(friendshipRepository.findByRequesterIdOrReceiverId(1L, 1L)).thenReturn(List.of(accepted));
        when(userRepository.findById(2L)).thenReturn(Optional.of(friendUser));
        when(informationItemRepository.findByUserIdAndProcessStatus(2L, "PROCESSED")).thenReturn(List.of(item));

        // When
        ResponseEntity<?> response = controller.getFriendNutrition(2L);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        assertNotNull(body.get("data"));
        assertNotNull(body.get("totalHours"));
    }

    @SuppressWarnings("unchecked")
    @Test
    void getFriendNutrition_ReturnsEmptyWhenNoReportExists() {
        // Given
        Friendship accepted = new Friendship();
        accepted.setId(1L);
        accepted.setRequesterId(1L);
        accepted.setReceiverId(2L);
        accepted.setStatus(FriendshipStatus.ACCEPTED);

        User friendUser = new User();
        friendUser.setId(2L);
        friendUser.setUsername("bob");
        friendUser.setDefaultVisibility(Visibility.PUBLIC);

        when(friendshipRepository.findByRequesterIdOrReceiverId(1L, 1L)).thenReturn(List.of(accepted));
        when(userRepository.findById(2L)).thenReturn(Optional.of(friendUser));
        when(informationItemRepository.findByUserIdAndProcessStatus(2L, "PROCESSED")).thenReturn(Collections.emptyList());

        // When
        ResponseEntity<?> response = controller.getFriendNutrition(2L);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        assertEquals(0.0, body.get("totalHours"));
    }

    @Test
    void getFriendNutrition_ReturnsForbiddenWhenNotFriend() {
        // Given
        when(friendshipRepository.findByRequesterIdOrReceiverId(1L, 1L)).thenReturn(Collections.emptyList());

        // When
        ResponseEntity<?> response = controller.getFriendNutrition(2L);

        // Then
        assertEquals(403, response.getStatusCode().value());
    }

    @Test
    void getFriendNutrition_ReturnsForbiddenWhenVisibilityIsPrivate() {
        // Given
        Friendship accepted = new Friendship();
        accepted.setId(1L);
        accepted.setRequesterId(1L);
        accepted.setReceiverId(2L);
        accepted.setStatus(FriendshipStatus.ACCEPTED);

        User friendUser = new User();
        friendUser.setId(2L);
        friendUser.setDefaultVisibility(Visibility.PRIVATE);

        when(friendshipRepository.findByRequesterIdOrReceiverId(1L, 1L)).thenReturn(List.of(accepted));
        when(userRepository.findById(2L)).thenReturn(Optional.of(friendUser));

        // When
        ResponseEntity<?> response = controller.getFriendNutrition(2L);

        // Then
        assertEquals(403, response.getStatusCode().value());
    }

    @SuppressWarnings("unchecked")
    @Test
    void getFriendWordCloud_ReturnsWordCloud() throws Exception {
        // Given
        Friendship accepted = new Friendship();
        accepted.setId(1L);
        accepted.setRequesterId(1L);
        accepted.setReceiverId(2L);
        accepted.setStatus(FriendshipStatus.ACCEPTED);

        User friendUser = new User();
        friendUser.setId(2L);
        friendUser.setUsername("bob");
        friendUser.setDefaultVisibility(Visibility.PUBLIC);

        Map<String, Object> kw1 = Map.of("word", "大模型", "weight", 100);
        Map<String, Object> wordCloudData = Map.of("keywords", List.of(kw1));

        when(friendshipRepository.findByRequesterIdOrReceiverId(1L, 1L)).thenReturn(List.of(accepted));
        when(userRepository.findById(2L)).thenReturn(Optional.of(friendUser));
        when(wordCloudService.getWordCloud(eq(2L), any(LocalDate.class))).thenReturn(wordCloudData);

        // When
        ResponseEntity<?> response = controller.getFriendWordCloud(2L);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        List<Map<String, Object>> body = (List<Map<String, Object>>) response.getBody();
        assertNotNull(body);
        assertEquals(1, body.size());
    }

    @Test
    void getFriendWordCloud_ReturnsForbiddenWhenNotFriend() {
        // Given
        when(friendshipRepository.findByRequesterIdOrReceiverId(1L, 1L)).thenReturn(Collections.emptyList());

        // When
        ResponseEntity<?> response = controller.getFriendWordCloud(2L);

        // Then
        assertEquals(403, response.getStatusCode().value());
    }

    @Test
    void getFriendWordCloud_ReturnsForbiddenWhenVisibilityIsPrivate() {
        // Given
        Friendship accepted = new Friendship();
        accepted.setId(1L);
        accepted.setRequesterId(1L);
        accepted.setReceiverId(2L);
        accepted.setStatus(FriendshipStatus.ACCEPTED);

        User friendUser = new User();
        friendUser.setId(2L);
        friendUser.setUsername("bob");
        friendUser.setDefaultVisibility(Visibility.PRIVATE);

        when(friendshipRepository.findByRequesterIdOrReceiverId(1L, 1L)).thenReturn(List.of(accepted));
        when(userRepository.findById(2L)).thenReturn(Optional.of(friendUser));

        // When
        ResponseEntity<?> response = controller.getFriendWordCloud(2L);

        // Then
        assertEquals(403, response.getStatusCode().value());
    }

    @Test
    void getFriendWordCloud_ReturnsEmptyWhenServiceThrowsException() throws Exception {
        // Given — covers the catch (Exception e) block at lines 140-143
        Friendship accepted = new Friendship();
        accepted.setId(1L);
        accepted.setRequesterId(1L);
        accepted.setReceiverId(2L);
        accepted.setStatus(FriendshipStatus.ACCEPTED);

        User friendUser = new User();
        friendUser.setId(2L);
        friendUser.setUsername("bob");
        friendUser.setDefaultVisibility(Visibility.PUBLIC);

        when(friendshipRepository.findByRequesterIdOrReceiverId(1L, 1L)).thenReturn(List.of(accepted));
        when(userRepository.findById(2L)).thenReturn(Optional.of(friendUser));
        when(wordCloudService.getWordCloud(eq(2L), any(LocalDate.class))).thenThrow(new RuntimeException("Service error"));

        // When
        ResponseEntity<?> response = controller.getFriendWordCloud(2L);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        List<?> body = (List<?>) response.getBody();
        assertNotNull(body);
        assertTrue(body.isEmpty());
    }

    @SuppressWarnings("unchecked")
    @Test
    void getFriendWordCloud_ReturnsEmptyWhenKeywordsIsNull() throws Exception {
        // Given — covers the path where wordCloudData is not null but has no "keywords" key
        Friendship accepted = new Friendship();
        accepted.setId(1L);
        accepted.setRequesterId(1L);
        accepted.setReceiverId(2L);
        accepted.setStatus(FriendshipStatus.ACCEPTED);

        User friendUser = new User();
        friendUser.setId(2L);
        friendUser.setUsername("bob");
        friendUser.setDefaultVisibility(Visibility.PUBLIC);

        Map<String, Object> wordCloudData = Map.of(); // no "keywords" key

        when(friendshipRepository.findByRequesterIdOrReceiverId(1L, 1L)).thenReturn(List.of(accepted));
        when(userRepository.findById(2L)).thenReturn(Optional.of(friendUser));
        when(wordCloudService.getWordCloud(eq(2L), any(LocalDate.class))).thenReturn(wordCloudData);

        // When
        ResponseEntity<?> response = controller.getFriendWordCloud(2L);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        List<Map<String, Object>> body = (List<Map<String, Object>>) response.getBody();
        assertNotNull(body);
        assertTrue(body.isEmpty());
    }

    @SuppressWarnings("unchecked")
    @Test
    void getFriendNutrition_ReturnsEmptyWhenAllNutritionIsZero() {
        // Given — covers the total == 0 branch (line 87) where items exist but all nutrition values are null
        Friendship accepted = new Friendship();
        accepted.setId(1L);
        accepted.setRequesterId(1L);
        accepted.setReceiverId(2L);
        accepted.setStatus(FriendshipStatus.ACCEPTED);

        User friendUser = new User();
        friendUser.setId(2L);
        friendUser.setUsername("bob");
        friendUser.setDefaultVisibility(Visibility.PUBLIC);

        InformationItem item = new InformationItem();
        item.setId(10L);
        item.setUserId(2L);
        item.setProcessStatus("PROCESSED");
        // All nutrition fields left null → total is 0

        when(friendshipRepository.findByRequesterIdOrReceiverId(1L, 1L)).thenReturn(List.of(accepted));
        when(userRepository.findById(2L)).thenReturn(Optional.of(friendUser));
        when(informationItemRepository.findByUserIdAndProcessStatus(2L, "PROCESSED")).thenReturn(List.of(item));

        // When
        ResponseEntity<?> response = controller.getFriendNutrition(2L);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        assertEquals(0.0, body.get("totalHours"));
        List<?> data = (List<?>) body.get("data");
        assertTrue(data.isEmpty());
    }

    @Test
    void getFriendNutrition_ReturnsOkForSelf() {
        // Given — covers isFriend returning true via currentUserId.equals(targetUserId) (line 42)
        when(userRepository.findById(1L)).thenReturn(Optional.of(currentUser));
        when(informationItemRepository.findByUserIdAndProcessStatus(1L, "PROCESSED")).thenReturn(Collections.emptyList());

        // When — userId == currentUserId == 1L
        ResponseEntity<?> response = controller.getFriendNutrition(1L);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
    }

    @Test
    void getFriendNutrition_ThrowsExceptionWhenUserNotFound() {
        // Given — covers the orElseThrow in getCurrentUserId (line 37)
        when(userRepository.findByUsername("alice")).thenReturn(Optional.empty());

        // When & Then
        assertThrows(RuntimeException.class, () -> controller.getFriendNutrition(2L));
    }
}
