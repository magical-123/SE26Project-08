package com.infodigest.security;

import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.*;

class JwtUtilTest {
    @Test
    void generatesAndValidatesTokenWithUserId() {
        JwtUtil jwt = new JwtUtil();
        ReflectionTestUtils.setField(jwt, "secret", "01234567890123456789012345678901");
        String token = jwt.generateToken("alice", 42L);
        assertEquals("alice", jwt.extractUsername(token));
        assertEquals(42L, jwt.extractUserId(token));
        assertTrue(jwt.isTokenValid(token, "alice"));
        assertFalse(jwt.isTokenValid(token, "bob"));
    }
}
