package com.infodigest.controller;

import com.infodigest.entity.User;
import com.infodigest.repository.UserRepository;
import com.infodigest.service.AIPersonaService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/persona")
@Slf4j
public class AIPersonaController {

    @Autowired
    private AIPersonaService aiPersonaService;

    @Autowired
    private UserRepository userRepository;

    private Long getCurrentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        String username = authentication.getName();
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));
        return user.getId();
    }

    @GetMapping
    public ResponseEntity<?> getAIPersona(@RequestParam(defaultValue = "false") boolean forceRefresh) {
        try {
            Long userId = getCurrentUserId();
            Map<String, Object> persona = aiPersonaService.generatePersona(userId, forceRefresh);
            
            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("data", persona);
            
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("获取 AI 画像失败: {}", e.getMessage(), e);
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "error", e.getMessage()
            ));
        }
    }
}
