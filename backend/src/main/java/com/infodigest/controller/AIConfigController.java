package com.infodigest.controller;

import com.infodigest.entity.AIConfig;
import com.infodigest.repository.AIConfigRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/ai-config")
@Slf4j
public class AIConfigController {

    @Autowired
    private AIConfigRepository configRepository;

    @PostMapping("/save")
    public ResponseEntity<?> saveAIConfig(@RequestBody AIConfigRequest request) {
        try {
            AIConfig config = configRepository.findByUserId(request.getUserId())
                    .orElse(new AIConfig());

            config.setUserId(request.getUserId());
            config.setModelType(request.getModelType());
            config.setApiKey(request.getApiKey());
            config.setApiEndpoint(request.getApiEndpoint());
            config.setMaxTokens(request.getMaxTokens());
            config.setCustomModelName(request.getCustomModelName());

            configRepository.save(config);

            log.info("AI config saved for user {}: modelType={}", request.getUserId(), request.getModelType());

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

    @GetMapping("/{userId}")
    public ResponseEntity<?> getAIConfig(@PathVariable Long userId) {
        try {
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
            log.error("Failed to get AI config for user {}: {}", userId, e.getMessage());
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "获取配置失败: " + e.getMessage()
            ));
        }
    }

    @DeleteMapping("/{userId}")
    public ResponseEntity<?> deleteAIConfig(@PathVariable Long userId) {
        try {
            AIConfig config = configRepository.findByUserId(userId)
                    .orElseThrow(() -> new RuntimeException("未找到用户的AI配置"));

            configRepository.delete(config);

            log.info("AI config deleted for user {}", userId);

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "AI配置已删除"
            ));

        } catch (Exception e) {
            log.error("Failed to delete AI config for user {}: {}", userId, e.getMessage());
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "删除失败: " + e.getMessage()
            ));
        }
    }

    // DTO for request
    public static class AIConfigRequest {
        private Long userId;
        private String modelType;
        private String apiKey;
        private String apiEndpoint;
        private Integer maxTokens;
        private String customModelName;

        // Getters and Setters
        public Long getUserId() { return userId; }
        public void setUserId(Long userId) { this.userId = userId; }

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
