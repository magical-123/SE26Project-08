package com.infodigest.controller;

import com.infodigest.entity.AIConfig;
import com.infodigest.entity.User;
import com.infodigest.repository.AIConfigRepository;
import com.infodigest.repository.UserRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/ai-config")
@Slf4j
public class AIConfigController {

    @Autowired
    private AIConfigRepository configRepository;

    @Autowired
    private UserRepository userRepository;

    @PostMapping("/save")
    public ResponseEntity<?> saveAIConfig(@RequestBody AIConfigRequest request) {
        try {
            Long userId = getCurrentUserId();
            AIConfig config = configRepository.findByUserId(userId)
                    .orElse(new AIConfig());

            config.setUserId(userId);
            config.setModelType(request.getModelType());

            // 只有当传入的 API Key 不为 null 时才更新（保存时去除首尾空格，避免 DeepSeek/LiteLLM 鉴权失败）
            if (request.getApiKey() != null) {
                config.setApiKey(request.getApiKey().trim());
            }

            // 只有当传入的 API Endpoint 不为 null 时才更新
            if (request.getApiEndpoint() != null) {
                config.setApiEndpoint(request.getApiEndpoint().trim());
            }

            config.setMaxTokens(request.getMaxTokens());

            // 只有当传入的自定义模型名不为 null 时才更新
            if (request.getCustomModelName() != null) {
                config.setCustomModelName(request.getCustomModelName().trim());
            }

            configRepository.save(config);

            log.info("AI config saved for user {}: modelType={}", userId, request.getModelType());

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "AI配置保存成功",
                    "userId", config.getUserId(),
                    "modelType", config.getModelType()
            ));

        } catch (Exception e) {
            log.error("Failed to save AI config: {}", e.getMessage());
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "保存失败: " + e.getMessage()
            ));
        }
    }

    @GetMapping("/me")
    public ResponseEntity<?> getAIConfig() {
        try {
            Long userId = getCurrentUserId();
            AIConfig config = configRepository.findByUserId(userId)
                    .orElseThrow(() -> new RuntimeException("未找到用户的AI配置"));

            // 隐藏 API Key 的敏感部分
            String maskedApiKey = config.getApiKey() != null
                    ? config.getApiKey().substring(0, Math.min(10, config.getApiKey().length())) + "..."
                    : null;

            return ResponseEntity.ok(Map.of(
                    "userId", config.getUserId(),
                    "modelType", config.getModelType(),
                    "apiKey", maskedApiKey,
                    "apiEndpoint", config.getApiEndpoint() != null ? config.getApiEndpoint() : "",
                    "maxTokens", config.getMaxTokens() != null ? config.getMaxTokens() : 0,
                    "customModelName", config.getCustomModelName() != null ? config.getCustomModelName() : ""
            ));

        } catch (Exception e) {
            log.error("Failed to get AI config for current user: {}", e.getMessage());
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "获取配置失败: " + e.getMessage()
            ));
        }
    }

    @DeleteMapping("/me")
    public ResponseEntity<?> deleteAIConfig() {
        try {
            Long userId = getCurrentUserId();
            AIConfig config = configRepository.findByUserId(userId)
                    .orElseThrow(() -> new RuntimeException("未找到用户的AI配置"));

            configRepository.delete(config);

            log.info("AI config deleted for user {}", userId);

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "AI配置已删除"
            ));

        } catch (Exception e) {
            log.error("Failed to delete AI config for current user: {}", e.getMessage());
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "删除失败: " + e.getMessage()
            ));
        }
    }

    private Long getCurrentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        String username = authentication.getName();
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));
        return user.getId();
    }

    // DTO for request
    public static class AIConfigRequest {
        private String modelType;
        private String apiKey;
        private String apiEndpoint;
        private Integer maxTokens;
        private String customModelName;

        // Getters and Setters
        public String getModelType() { return modelType; }
        public void setModelType(String modelType) { this.modelType = modelType; }

        public String getApiKey() { return apiKey; }
        public void setApiKey(String apiKey) { this.apiKey = apiKey; }

        public String getApiEndpoint() { return apiEndpoint; }
        public void setApiEndpoint(String apiEndpoint) { this.apiEndpoint = apiEndpoint; }

        public Integer getMaxTokens() { return maxTokens; }
        public void setMaxTokens(Integer maxTokens) { this.maxTokens = maxTokens; }

        public String getCustomModelName() { return customModelName; }
        public void setCustomModelName(String customModelName) { this.customModelName = customModelName; }
    }
}
