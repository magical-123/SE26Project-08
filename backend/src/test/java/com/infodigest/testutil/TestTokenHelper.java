package com.infodigest.testutil;

import com.infodigest.security.JwtUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Component
public class TestTokenHelper {

    @Autowired
    private JwtUtil jwtUtil;

    public String createToken(String username, Long userId) {
        return jwtUtil.generateToken(username, userId);
    }
}
