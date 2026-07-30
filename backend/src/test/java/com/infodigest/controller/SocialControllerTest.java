package com.infodigest.controller;

import com.infodigest.entity.Friendship;
import com.infodigest.entity.FriendshipStatus;
import com.infodigest.entity.User;
import com.infodigest.repository.FriendshipRepository;
import com.infodigest.repository.UserRepository;
import org.junit.jupiter.api.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class SocialControllerTest {
    private FriendshipRepository friendships;
    private UserRepository users;
    private SocialController controller;

    @BeforeEach
    void setUp() {
        friendships = mock(FriendshipRepository.class);
        users = mock(UserRepository.class);
        controller = new SocialController(friendships, users);
        when(users.findByUsername("alice")).thenReturn(Optional.of(user(1, "alice")));
        SecurityContextHolder.getContext().setAuthentication(
                UsernamePasswordAuthenticationToken.authenticated("alice", null, List.of()));
    }

    @AfterEach void clear() { SecurityContextHolder.clearContext(); }

    private User user(long id, String name) {
        User user = new User();
        user.setId(id); user.setUsername(name);
        return user;
    }

    private Friendship friendship(long id, long requester, long receiver, FriendshipStatus status) {
        Friendship value = new Friendship();
        value.setId(id); value.setRequesterId(requester); value.setReceiverId(receiver);
        value.setStatus(status);
        return value;
    }

    @Test
    void listsAcceptedFriendsWithOnlineAndUnknownStates() {
        Friendship online = friendship(1, 1, 2, FriendshipStatus.ACCEPTED);
        Friendship unknown = friendship(2, 3, 1, FriendshipStatus.ACCEPTED);
        Friendship pending = friendship(3, 1, 4, FriendshipStatus.PENDING);
        when(friendships.findByRequesterIdOrReceiverId(1L, 1L))
                .thenReturn(List.of(online, unknown, pending));
        User bob = user(2, "bob"); bob.setLastActiveAt(LocalDateTime.now());
        when(users.findById(2L)).thenReturn(Optional.of(bob));
        when(users.findById(3L)).thenReturn(Optional.empty());
        var body = controller.getFriends().getBody();
        assertEquals(2, body.size());
        assertEquals(true, body.get(0).get("isOnline"));
        assertEquals("Unknown", body.get(1).get("name"));
        when(friendships.findByRequesterIdOrReceiverId(1L, 1L)).thenReturn(List.of());
        assertEquals(0, controller.getFriends().getBody().size());
    }

    @Test
    void listsIncomingAndOutgoingPendingRequests() {
        Friendship incoming = friendship(1, 2, 1, FriendshipStatus.PENDING);
        Friendship outgoing = friendship(2, 1, 3, FriendshipStatus.PENDING);
        when(friendships.findByRequesterIdOrReceiverId(1L, 1L))
                .thenReturn(List.of(incoming, outgoing, friendship(3, 1, 4, FriendshipStatus.ACCEPTED)));
        when(users.findById(2L)).thenReturn(Optional.of(user(2, "bob")));
        var body = controller.getRequests().getBody();
        assertEquals(2, body.size());
        assertEquals("received", body.get(0).get("direction"));
        assertEquals("sent", body.get(1).get("direction"));
        assertEquals("Unknown", body.get(1).get("username"));
    }

    @Test
    void sendsAcceptsAndRejectsRequestsWithAuthorizationChecks() {
        when(friendships.save(any())).thenAnswer(i -> i.getArgument(0));
        Friendship created = controller.sendRequest(Map.of("receiverId", 2)).getBody();
        assertEquals(1L, created.getRequesterId());
        assertEquals(2L, created.getReceiverId());

        Friendship received = friendship(5, 2, 1, FriendshipStatus.PENDING);
        when(friendships.findById(5L)).thenReturn(Optional.of(received));
        assertEquals(200, controller.acceptRequest(5L).getStatusCode().value());
        assertEquals(FriendshipStatus.ACCEPTED, received.getStatus());
        assertEquals(200, controller.rejectRequest(5L).getStatusCode().value());

        Friendship foreign = friendship(6, 2, 3, FriendshipStatus.PENDING);
        when(friendships.findById(6L)).thenReturn(Optional.of(foreign));
        assertEquals(403, controller.acceptRequest(6L).getStatusCode().value());
        assertEquals(403, controller.rejectRequest(6L).getStatusCode().value());
        when(friendships.findById(9L)).thenReturn(Optional.empty());
        assertEquals(404, controller.acceptRequest(9L).getStatusCode().value());
        assertEquals(404, controller.rejectRequest(9L).getStatusCode().value());
        when(friendships.findById(7L)).thenReturn(Optional.of(
                friendship(7, 2, 1, FriendshipStatus.ACCEPTED)));
        assertEquals(400, controller.acceptRequest(7L).getStatusCode().value());
    }

    @Test
    void searchesUsersAndExcludesCurrentAccount() {
        when(users.findByUsernameContainingIgnoreCase("a"))
                .thenReturn(List.of(user(1, "alice"), user(2, "carol")));
        var body = controller.searchUsers("a").getBody();
        assertEquals(1, body.size());
        assertEquals("carol", body.get(0).get("username"));
    }
}
