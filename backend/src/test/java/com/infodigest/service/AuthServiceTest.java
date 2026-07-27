package com.infodigest.service;

import com.infodigest.dto.LoginRequest;
import com.infodigest.dto.RegisterRequest;
import com.infodigest.entity.User;
import com.infodigest.repository.UserRepository;
import com.infodigest.security.JwtUtil;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class AuthServiceTest {
    @Test
    void registersNewUserAndReturnsToken() {
        UserRepository users = mock(UserRepository.class);
        PasswordEncoder encoder = mock(PasswordEncoder.class);
        JwtUtil jwt = mock(JwtUtil.class);
        when(users.findByUsername("alice")).thenReturn(Optional.empty());
        when(users.findByEmail("alice@example.com")).thenReturn(Optional.empty());
        when(encoder.encode("password")).thenReturn("hashed");
        when(jwt.generateToken("alice", null)).thenReturn("jwt");
        AuthService service = new AuthService(users, encoder, jwt);

        RegisterRequest request = new RegisterRequest();
        request.setUsername("alice");
        request.setEmail("alice@example.com");
        request.setPassword("password");
        assertEquals("jwt", service.register(request).getToken());
        verify(users).save(any(User.class));
    }

    @Test
    void rejectsDuplicateUsernameAndInvalidLogin() {
        UserRepository users = mock(UserRepository.class);
        PasswordEncoder encoder = mock(PasswordEncoder.class);
        JwtUtil jwt = mock(JwtUtil.class);
        User existing = new User();
        existing.setUsername("alice");
        when(users.findByUsername("alice")).thenReturn(Optional.of(existing));
        AuthService service = new AuthService(users, encoder, jwt);

        RegisterRequest request = new RegisterRequest();
        request.setUsername("alice");
        request.setEmail("a@example.com");
        assertThrows(RuntimeException.class, () -> service.register(request));

        LoginRequest login = new LoginRequest();
        login.setUsername("missing");
        login.setPassword("bad");
        when(users.findByUsername("missing")).thenReturn(Optional.empty());
        assertThrows(RuntimeException.class, () -> service.login(login));
    }
}
