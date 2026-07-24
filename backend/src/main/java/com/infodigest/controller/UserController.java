package com.infodigest.controller;

import com.infodigest.entity.User;
import com.infodigest.entity.Visibility;
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

    private User getUserFromToken(String authHeader) {
        String token = authHeader.replace("Bearer ", "");
        Long userId = jwtUtil.extractUserId(token);
        return userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    @GetMapping("/profile")
    public ResponseEntity<?> getProfile(@RequestHeader("Authorization") String authHeader) {
        try {
            User user = getUserFromToken(authHeader);
            return ResponseEntity.ok(Map.of(
                    "id", user.getId(),
                    "username", user.getUsername(),
                    "email", user.getEmail(),
                    "avatarUrl", user.getAvatarUrl() != null ? user.getAvatarUrl() : "",
                    "defaultVisibility", user.getDefaultVisibility().name(),
                    "hiddenPlatforms", user.getHiddenPlatforms() != null ? user.getHiddenPlatforms() : "[]",
                    "createdAt", user.getCreatedAt(),
                    "selfPortrait", user.getSelfPortrait() != null ? user.getSelfPortrait() : ""
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
            User user = getUserFromToken(authHeader);

            if (body.containsKey("username")) {
                String newUsername = body.get("username");
                if (newUsername == null || newUsername.trim().isEmpty()) {
                    return ResponseEntity.badRequest().body("Username cannot be empty");
                }
                if (!newUsername.equals(user.getUsername()) &&
                        userRepository.findByUsername(newUsername).isPresent()) {
                    return ResponseEntity.badRequest().body("Username is already taken!");
                }
                user.setUsername(newUsername);
            }

            if (body.containsKey("email")) {
                String newEmail = body.get("email");
                if (!newEmail.equals(user.getEmail()) &&
                        userRepository.findByEmail(newEmail).isPresent()) {
                    return ResponseEntity.badRequest().body("Email is already taken!");
                }
                user.setEmail(newEmail);
            }

            if (body.containsKey("selfPortrait")) {
                user.setSelfPortrait(body.get("selfPortrait"));
            }

            userRepository.save(user);

            return ResponseEntity.ok(Map.of(
                    "id", user.getId(),
                    "username", user.getUsername(),
                    "email", user.getEmail(),
                    "avatarUrl", user.getAvatarUrl() != null ? user.getAvatarUrl() : "",
                    "message", "Profile updated successfully"
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PutMapping("/privacy")
    public ResponseEntity<?> updatePrivacy(
            @RequestHeader("Authorization") String authHeader,
            @RequestBody Map<String, Object> body) {
        try {
            User user = getUserFromToken(authHeader);
            Object publicGraph = body.get("publicGraph");
            if (!(publicGraph instanceof Boolean)) {
                return ResponseEntity.badRequest().body("publicGraph must be a boolean");
            }
            user.setDefaultVisibility((Boolean) publicGraph ? Visibility.PUBLIC : Visibility.PRIVATE);
            userRepository.save(user);
            return ResponseEntity.ok(Map.of(
                    "publicGraph", user.getDefaultVisibility() == Visibility.PUBLIC,
                    "defaultVisibility", user.getDefaultVisibility().name()
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PutMapping("/avatar")
    public ResponseEntity<?> updateAvatar(
            @RequestHeader("Authorization") String authHeader,
            @RequestBody Map<String, String> body) {
        try {
            User user = getUserFromToken(authHeader);
            String avatarUrl = body.get("avatarUrl");

            if (avatarUrl == null || avatarUrl.isEmpty()) {
                return ResponseEntity.badRequest().body("avatarUrl is required");
            }

            user.setAvatarUrl(avatarUrl);
            userRepository.save(user);

            return ResponseEntity.ok(Map.of(
                    "avatarUrl", avatarUrl,
                    "message", "Avatar updated successfully"
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}
