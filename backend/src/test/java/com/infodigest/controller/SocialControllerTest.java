package com.infodigest.controller;

import com.infodigest.entity.Friendship;
import com.infodigest.entity.FriendshipStatus;
import com.infodigest.entity.User;
import com.infodigest.repository.FriendshipRepository;
import com.infodigest.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
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
        User current = new User();
        current.setId(1L);
        current.setUsername("alice");
        when(users.findByUsername("alice")).thenReturn(Optional.of(current));
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("alice", null));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void onlyReceiverCanAcceptPendingRequest() {
        Friendship request = new Friendship();
        request.setId(9L);
        request.setRequesterId(1L);
        request.setReceiverId(2L);
        request.setStatus(FriendshipStatus.PENDING);
        when(friendships.findById(9L)).thenReturn(Optional.of(request));

        assertEquals(403, controller.acceptRequest(9L).getStatusCode().value());
        verify(friendships, never()).save(any());
    }

    @Test
    void participantCanRejectRequest() {
        Friendship request = new Friendship();
        request.setId(9L);
        request.setRequesterId(1L);
        request.setReceiverId(2L);
        request.setStatus(FriendshipStatus.PENDING);
        when(friendships.findById(9L)).thenReturn(Optional.of(request));

        assertEquals(200, controller.rejectRequest(9L).getStatusCode().value());
        verify(friendships).delete(request);
    }
}
