package com.infodigest.controller;

import com.infodigest.entity.Friendship;
import com.infodigest.entity.FriendshipStatus;
import com.infodigest.entity.User;
import com.infodigest.repository.FriendshipRepository;
import com.infodigest.repository.UserRepository;
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

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SocialControllerTest {

    @Mock
    private FriendshipRepository friendshipRepository;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private SocialController controller;

    private final User currentUser = new User();

    @BeforeEach
    void setUp() {
        currentUser.setId(1L);
        currentUser.setUsername("alice");
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(currentUser));
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("alice", null, java.util.List.of()));
    }

    @AfterEach void clear() { SecurityContextHolder.clearContext(); }

    private User user(long id, String name) {
        User u = new User();
        u.setId(id); u.setUsername(name);
        return u;
    }

    private Friendship friendship(long id, long requester, long receiver, FriendshipStatus status) {
        Friendship f = new Friendship();
        f.setId(id); f.setRequesterId(requester); f.setReceiverId(receiver);
        f.setStatus(status);
        return f;
    }

    @SuppressWarnings("unchecked")
    @Test
    void searchUsers_ReturnsUserList() {
        User user1 = new User();
        user1.setId(2L);
        user1.setUsername("bob");

        User user2 = new User();
        user2.setId(3L);
        user2.setUsername("bobby");

        when(userRepository.findByUsernameContainingIgnoreCase("bob")).thenReturn(List.of(user1, user2));

        ResponseEntity<List<Map<String, Object>>> response = controller.searchUsers("bob");

        assertEquals(HttpStatus.OK, response.getStatusCode());
        List<Map<String, Object>> body = response.getBody();
        assertNotNull(body);
        assertEquals(2, body.size());
        assertEquals("bob", body.get(0).get("username"));
        verify(userRepository).findByUsernameContainingIgnoreCase("bob");
    }

    @SuppressWarnings("unchecked")
    @Test
    void searchUsers_ExcludesCurrentUser() {
        User sameUser = new User();
        sameUser.setId(1L);
        sameUser.setUsername("alice");

        when(userRepository.findByUsernameContainingIgnoreCase("alice")).thenReturn(List.of(sameUser));

        ResponseEntity<List<Map<String, Object>>> response = controller.searchUsers("alice");

        assertEquals(HttpStatus.OK, response.getStatusCode());
        List<Map<String, Object>> body = response.getBody();
        assertNotNull(body);
        assertTrue(body.isEmpty());
    }

    @Test
    void sendFriendRequest_SendsRequest() {
        Map<String, Object> requestBody = Map.of("receiverId", 2L);
        when(friendshipRepository.save(any(Friendship.class))).thenAnswer(invocation -> {
            Friendship f = invocation.getArgument(0);
            f.setId(10L);
            return f;
        });

        ResponseEntity<Friendship> response = controller.sendRequest(requestBody);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        Friendship body = response.getBody();
        assertNotNull(body);
        assertEquals(1L, body.getRequesterId());
        assertEquals(2L, body.getReceiverId());
        assertEquals(FriendshipStatus.PENDING, body.getStatus());
        verify(friendshipRepository).save(any(Friendship.class));
    }

    @Test
    void acceptFriendRequest_AcceptsPendingRequest() {
        Friendship pendingRequest = new Friendship();
        pendingRequest.setId(9L);
        pendingRequest.setRequesterId(2L);
        pendingRequest.setReceiverId(1L);
        pendingRequest.setStatus(FriendshipStatus.PENDING);

        when(friendshipRepository.findById(9L)).thenReturn(Optional.of(pendingRequest));
        when(friendshipRepository.save(any(Friendship.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ResponseEntity<Void> response = controller.acceptRequest(9L);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(FriendshipStatus.ACCEPTED, pendingRequest.getStatus());
        verify(friendshipRepository).save(pendingRequest);
    }

    @Test
    void acceptFriendRequest_RejectsWhenNotReceiver() {
        Friendship pendingRequest = new Friendship();
        pendingRequest.setId(9L);
        pendingRequest.setRequesterId(2L);
        pendingRequest.setReceiverId(3L);
        pendingRequest.setStatus(FriendshipStatus.PENDING);

        when(friendshipRepository.findById(9L)).thenReturn(Optional.of(pendingRequest));

        ResponseEntity<Void> response = controller.acceptRequest(9L);

        assertEquals(403, response.getStatusCode().value());
        verify(friendshipRepository, never()).save(any());
    }

    @SuppressWarnings("unchecked")
    @Test
    void getFriendsList_ReturnsFriends() {
        Friendship accepted1 = new Friendship();
        accepted1.setId(1L);
        accepted1.setRequesterId(1L);
        accepted1.setReceiverId(2L);
        accepted1.setStatus(FriendshipStatus.ACCEPTED);

        User friend = new User();
        friend.setId(2L);
        friend.setUsername("bob");

        when(friendshipRepository.findByRequesterIdOrReceiverId(1L, 1L)).thenReturn(List.of(accepted1));
        when(userRepository.findById(2L)).thenReturn(Optional.of(friend));

        ResponseEntity<List<Map<String, Object>>> response = controller.getFriends();

        assertEquals(HttpStatus.OK, response.getStatusCode());
        List<Map<String, Object>> body = response.getBody();
        assertNotNull(body);
        assertEquals(1, body.size());
        assertEquals(2L, body.get(0).get("id"));
        assertEquals("bob", body.get(0).get("name"));
    }

    @SuppressWarnings("unchecked")
    @Test
    void getFriendsList_ReturnsEmptyWhenNoFriends() {
        when(friendshipRepository.findByRequesterIdOrReceiverId(1L, 1L)).thenReturn(Collections.emptyList());

        ResponseEntity<List<Map<String, Object>>> response = controller.getFriends();

        assertEquals(HttpStatus.OK, response.getStatusCode());
        List<Map<String, Object>> body = response.getBody();
        assertNotNull(body);
        assertTrue(body.isEmpty());
    }

    @Test
    void listsAcceptedFriendsWithOnlineAndUnknownStates() {
        Friendship online = friendship(1, 1, 2, FriendshipStatus.ACCEPTED);
        Friendship unknown = friendship(2, 3, 1, FriendshipStatus.ACCEPTED);
        Friendship pending = friendship(3, 1, 4, FriendshipStatus.PENDING);
        when(friendshipRepository.findByRequesterIdOrReceiverId(1L, 1L))
                .thenReturn(List.of(online, unknown, pending));
        User bob = user(2, "bob"); bob.setLastActiveAt(LocalDateTime.now());
        when(userRepository.findById(2L)).thenReturn(Optional.of(bob));
        when(userRepository.findById(3L)).thenReturn(Optional.empty());
        var body = controller.getFriends().getBody();
        assertEquals(2, body.size());
        assertEquals(true, body.get(0).get("isOnline"));
        assertEquals("Unknown", body.get(1).get("name"));
        when(friendshipRepository.findByRequesterIdOrReceiverId(1L, 1L)).thenReturn(List.of());
        assertEquals(0, controller.getFriends().getBody().size());
    }

    @Test
    void listsIncomingAndOutgoingPendingRequests() {
        Friendship incoming = friendship(1, 2, 1, FriendshipStatus.PENDING);
        Friendship outgoing = friendship(2, 1, 3, FriendshipStatus.PENDING);
        when(friendshipRepository.findByRequesterIdOrReceiverId(1L, 1L))
                .thenReturn(List.of(incoming, outgoing, friendship(3, 1, 4, FriendshipStatus.ACCEPTED)));
        when(userRepository.findById(2L)).thenReturn(Optional.of(user(2, "bob")));
        var body = controller.getRequests().getBody();
        assertEquals(2, body.size());
        assertEquals("received", body.get(0).get("direction"));
        assertEquals("sent", body.get(1).get("direction"));
        assertEquals("Unknown", body.get(1).get("username"));
    }

    @Test
    void sendsAcceptsAndRejectsRequestsWithAuthorizationChecks() {
        when(friendshipRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        Friendship created = controller.sendRequest(Map.of("receiverId", 2)).getBody();
        assertEquals(1L, created.getRequesterId());
        assertEquals(2L, created.getReceiverId());

        Friendship received = friendship(5, 2, 1, FriendshipStatus.PENDING);
        when(friendshipRepository.findById(5L)).thenReturn(Optional.of(received));
        assertEquals(200, controller.acceptRequest(5L).getStatusCode().value());
        assertEquals(FriendshipStatus.ACCEPTED, received.getStatus());
        assertEquals(200, controller.rejectRequest(5L).getStatusCode().value());

        Friendship foreign = friendship(6, 2, 3, FriendshipStatus.PENDING);
        when(friendshipRepository.findById(6L)).thenReturn(Optional.of(foreign));
        assertEquals(403, controller.acceptRequest(6L).getStatusCode().value());
        assertEquals(403, controller.rejectRequest(6L).getStatusCode().value());
        when(friendshipRepository.findById(9L)).thenReturn(Optional.empty());
        assertEquals(404, controller.acceptRequest(9L).getStatusCode().value());
        assertEquals(404, controller.rejectRequest(9L).getStatusCode().value());
        when(friendshipRepository.findById(7L)).thenReturn(Optional.of(
                friendship(7, 2, 1, FriendshipStatus.ACCEPTED)));
        assertEquals(400, controller.acceptRequest(7L).getStatusCode().value());
    }

    @Test
    void searchesUsersAndExcludesCurrentAccount() {
        when(userRepository.findByUsernameContainingIgnoreCase("a"))
                .thenReturn(List.of(user(1, "alice"), user(2, "carol")));
        var body = controller.searchUsers("a").getBody();
        assertEquals(1, body.size());
        assertEquals("carol", body.get(0).get("username"));
    }

    @Test
    void onlyReceiverCanAcceptPendingRequest() {
        Friendship request = new Friendship();
        request.setId(9L);
        request.setRequesterId(1L);
        request.setReceiverId(2L);
        request.setStatus(FriendshipStatus.PENDING);
        when(friendshipRepository.findById(9L)).thenReturn(Optional.of(request));

        ResponseEntity<Void> response = controller.acceptRequest(9L);

        assertEquals(403, response.getStatusCode().value());
        verify(friendshipRepository, never()).save(any());
    }

    @Test
    void participantCanRejectRequest() {
        Friendship request = new Friendship();
        request.setId(9L);
        request.setRequesterId(1L);
        request.setReceiverId(2L);
        request.setStatus(FriendshipStatus.PENDING);
        when(friendshipRepository.findById(9L)).thenReturn(Optional.of(request));

        ResponseEntity<Void> response = controller.rejectRequest(9L);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        verify(friendshipRepository).delete(request);
    }
}
