package com.infodigest.controller;

import com.infodigest.entity.User;
import com.infodigest.repository.UserRepository;
import com.infodigest.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/user")
@RequiredArgsConstructor
public class UserController {

    private final UserRepository userRepository;
    private final JwtUtil jwtUtil;

    @GetMapping("/profile")
    public ResponseEntity<?> getProfile(@RequestHeader("Authorization") String authHeader) {
        try {
            String token = authHeader.replace("Bearer ", "");
            Long userId = jwtUtil.extractUserId(token);
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new RuntimeException("User not found"));

            return ResponseEntity.ok(Map.of(
                    "id", user.getId(),
                    "username", user.getUsername(),
                    "email", user.getEmail(),
                    "defaultVisibility", user.getDefaultVisibility().name(),
                    "hiddenPlatforms", user.getHiddenPlatforms() != null ? user.getHiddenPlatforms() : "[]",
                    "createdAt", user.getCreatedAt()
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PutMapping("/profile")
    public ResponseEntity<?> updateProfile(
            @RequestHeader("Authorization") String authHeader,
            @RequestBody Map<String, String> body) {
        try {
            String token = authHeader.replace("Bearer ", "");
            Long userId = jwtUtil.extractUserId(token);
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new RuntimeException("User not found"));

            if (body.containsKey("email")) {
                String newEmail = body.get("email");
                // Check if email is already taken by another user
                if (!newEmail.equals(user.getEmail()) &&
                        userRepository.findByEmail(newEmail).isPresent()) {
                    return ResponseEntity.badRequest().body("Email is already taken!");
                }
                user.setEmail(newEmail);
            }

            userRepository.save(user);

            return ResponseEntity.ok(Map.of(
                    "id", user.getId(),
                    "username", user.getUsername(),
                    "email", user.getEmail(),
                    "message", "Profile updated successfully"
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}