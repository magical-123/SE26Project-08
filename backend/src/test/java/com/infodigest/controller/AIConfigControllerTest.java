package com.infodigest.controller;

import com.infodigest.entity.AIConfig;
import com.infodigest.entity.User;
import com.infodigest.repository.AIConfigRepository;
import com.infodigest.repository.UserRepository;
import com.infodigest.security.CredentialCryptoService;
import com.infodigest.service.AIService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AIConfigControllerTest {

    @Mock
    private AIConfigRepository configRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private AIService aiService;

    @Mock
    private CredentialCryptoService credentialCryptoService;

    @InjectMocks
    private AIConfigController controller;

    private final User currentUser = new User();

    @BeforeEach
    void setUp() {
        currentUser.setId(1L);
        currentUser.setUsername("testuser");
        when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(currentUser));
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("testuser", null));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void getConfig_ReturnsConfig() {
        // Given
        AIConfig config = new AIConfig();
        config.setId(1L);
        config.setUserId(1L);
        config.setModelType("GPT_4");
        config.setApiKey("encrypted-key");
        config.setApiEndpoint("https://api.openai.com/v1");
        config.setMaxTokens(4096);
        config.setCustomModelName(null);

        when(configRepository.findByUserId(1L)).thenReturn(Optional.of(config));
        when(credentialCryptoService.decrypt("encrypted-key")).thenReturn("sk-abc12345xyz");

        // When
        ResponseEntity<?> response = controller.getAIConfig();

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        assertEquals(1L, body.get("userId"));
        assertEquals("GPT_4", body.get("modelType"));
        assertEquals("https://api.openai.com/v1", body.get("apiEndpoint"));
        assertEquals(4096, body.get("maxTokens"));
        verify(configRepository).findByUserId(1L);
    }

    @Test
    void getConfig_ReturnsErrorWhenNoConfig() {
        // Given
        when(configRepository.findByUserId(1L)).thenReturn(Optional.empty());

        // When
        ResponseEntity<?> response = controller.getAIConfig();

        // Then
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        assertFalse((Boolean) body.get("success"));
        assertTrue(((String) body.get("message")).contains("未找到"));
    }

    @Test
    void saveConfig_CreatesNewConfig() {
        // Given
        AIConfigController.AIConfigRequest request = new AIConfigController.AIConfigRequest();
        request.setModelType("GPT_4");
        request.setApiKey("sk-new-key");
        request.setApiEndpoint("https://api.openai.com/v1");
        request.setMaxTokens(2048);

        when(configRepository.findByUserId(1L)).thenReturn(Optional.empty());
        when(credentialCryptoService.encrypt("sk-new-key")).thenReturn("encrypted-new-key");

        // When
        ResponseEntity<?> response = controller.saveAIConfig(request);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        assertTrue((Boolean) body.get("success"));
        assertEquals("GPT_4", body.get("modelType"));
        verify(configRepository).save(any(AIConfig.class));
    }

    @Test
    void saveConfig_UpdatesExistingConfig() {
        // Given
        AIConfig existingConfig = new AIConfig();
        existingConfig.setId(1L);
        existingConfig.setUserId(1L);
        existingConfig.setModelType("GPT_3_5_TURBO");
        existingConfig.setApiKey("old-encrypted-key");
        existingConfig.setMaxTokens(1024);

        AIConfigController.AIConfigRequest request = new AIConfigController.AIConfigRequest();
        request.setModelType("GPT_4");
        request.setApiKey("sk-updated-key");
        request.setApiEndpoint("https://api.openai.com/v1");
        request.setMaxTokens(4096);

        when(configRepository.findByUserId(1L)).thenReturn(Optional.of(existingConfig));
        when(credentialCryptoService.encrypt("sk-updated-key")).thenReturn("new-encrypted-key");

        // When
        ResponseEntity<?> response = controller.saveAIConfig(request);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        assertTrue((Boolean) body.get("success"));
        assertEquals("GPT_4", body.get("modelType"));
        assertEquals("GPT_4", existingConfig.getModelType());
        assertEquals("new-encrypted-key", existingConfig.getApiKey());
        assertEquals("https://api.openai.com/v1", existingConfig.getApiEndpoint());
        assertEquals(4096, existingConfig.getMaxTokens());
        verify(configRepository).save(existingConfig);
    }

    @Test
    void saveConfig_PreservesExistingApiKeyWhenNotProvided() {
        // Given
        AIConfig existingConfig = new AIConfig();
        existingConfig.setId(1L);
        existingConfig.setUserId(1L);
        existingConfig.setModelType("GPT_4");
        existingConfig.setApiKey("existing-encrypted-key");
        existingConfig.setMaxTokens(2048);

        AIConfigController.AIConfigRequest request = new AIConfigController.AIConfigRequest();
        request.setModelType("GPT_4");
        request.setApiKey(null); // do not update API key
        request.setMaxTokens(4096);

        when(configRepository.findByUserId(1L)).thenReturn(Optional.of(existingConfig));

        // When
        ResponseEntity<?> response = controller.saveAIConfig(request);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("existing-encrypted-key", existingConfig.getApiKey());
        assertEquals(4096, existingConfig.getMaxTokens());
        verify(configRepository).save(existingConfig);
        verify(credentialCryptoService, never()).encrypt(anyString());
    }

    @Test
    void deleteConfig_Succeeds() {
        // Given
        AIConfig config = new AIConfig();
        config.setId(1L);
        config.setUserId(1L);
        config.setModelType("GPT_4");

        when(configRepository.findByUserId(1L)).thenReturn(Optional.of(config));

        // When
        ResponseEntity<?> response = controller.deleteAIConfig();

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        assertTrue((Boolean) body.get("success"));
        verify(configRepository).delete(config);
    }

    @Test
    void deleteAIConfig_ReturnsErrorWhenNotFound() {
        // Given
        when(configRepository.findByUserId(1L)).thenReturn(Optional.empty());

        // When
        ResponseEntity<?> response = controller.deleteAIConfig();

        // Then
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        assertFalse((Boolean) body.get("success"));
        assertTrue(((String) body.get("message")).contains("删除失败"));
    }

    @Test
    void testAIConfig_WithNewKey_Succeeds() throws Exception {
        // Given
        AIConfigController.AIConfigRequest request = new AIConfigController.AIConfigRequest();
        request.setModelType("GPT_4");
        request.setApiKey("sk-test-key");
        request.setApiEndpoint("https://api.openai.com/v1");
        request.setMaxTokens(2048);

        when(configRepository.findByUserId(1L)).thenReturn(Optional.empty());
        when(aiService.generateInsightWithConfig(anyString(), any(AIConfig.class)))
                .thenReturn("Hello");

        // When
        ResponseEntity<?> response = controller.testAIConfig(request);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        assertTrue((Boolean) body.get("success"));
        assertTrue(((String) body.get("message")).contains("连接成功"));
    }

    @Test
    void testAIConfig_FailsWithException() throws Exception {
        // Given
        AIConfigController.AIConfigRequest request = new AIConfigController.AIConfigRequest();
        request.setModelType("GPT_4");
        request.setApiKey("sk-bad-key");

        when(configRepository.findByUserId(1L)).thenReturn(Optional.empty());
        when(aiService.generateInsightWithConfig(anyString(), any(AIConfig.class)))
                .thenThrow(new RuntimeException("Connection refused"));

        // When
        ResponseEntity<?> response = controller.testAIConfig(request);

        // Then
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        assertFalse((Boolean) body.get("success"));
        assertTrue(((String) body.get("message")).contains("连接失败"));
    }

    // ==================== 补充测试：覆盖 saveAIConfig 异常路径 ====================

    @Test
    void saveAIConfig_FailsWithException() {
        // Given
        AIConfigController.AIConfigRequest request = new AIConfigController.AIConfigRequest();
        request.setModelType("GPT_4");
        request.setApiKey("sk-new-key");
        request.setApiEndpoint("https://api.openai.com/v1");
        request.setMaxTokens(2048);

        when(configRepository.findByUserId(1L)).thenReturn(Optional.empty());
        when(credentialCryptoService.encrypt("sk-new-key")).thenReturn("encrypted-new-key");
        doThrow(new RuntimeException("Database error")).when(configRepository).save(any(AIConfig.class));

        // When
        ResponseEntity<?> response = controller.saveAIConfig(request);

        // Then
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        assertFalse((Boolean) body.get("success"));
        assertTrue(((String) body.get("message")).contains("保存失败"));
    }

    // ==================== 补充测试：覆盖 getAIConfig 各分支 ====================

    @Test
    void getConfig_WhenPlainApiKeyIsNull() {
        // Given — decrypt 返回 null，导致 Map.of() 因 null 值抛出 NPE，进入 catch 块
        AIConfig config = new AIConfig();
        config.setId(1L);
        config.setUserId(1L);
        config.setModelType("GPT_4");
        config.setApiKey("encrypted-key");
        config.setApiEndpoint("https://api.openai.com/v1");
        config.setMaxTokens(4096);

        when(configRepository.findByUserId(1L)).thenReturn(Optional.of(config));
        when(credentialCryptoService.decrypt("encrypted-key")).thenReturn(null);

        // When
        ResponseEntity<?> response = controller.getAIConfig();

        // Then — Map.of() 禁止 null 值，所以会抛 NPE，返回 400
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        assertFalse((Boolean) body.get("success"));
    }

    @Test
    void getConfig_WhenMaxTokensIsNull() {
        // Given — maxTokens null 时应该返回 0
        AIConfig config = new AIConfig();
        config.setId(1L);
        config.setUserId(1L);
        config.setModelType("GPT_4");
        config.setApiKey("encrypted-key");
        config.setMaxTokens(null);

        when(configRepository.findByUserId(1L)).thenReturn(Optional.of(config));
        when(credentialCryptoService.decrypt("encrypted-key")).thenReturn("sk-abc");

        // When
        ResponseEntity<?> response = controller.getAIConfig();

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        assertEquals(0, body.get("maxTokens"));
    }

    @Test
    void getConfig_WhenDecryptionFails() {
        // Given — decrypt 抛出异常 => 进入 catch 块
        AIConfig config = new AIConfig();
        config.setId(1L);
        config.setUserId(1L);
        config.setModelType("GPT_4");
        config.setApiKey("encrypted-key");

        when(configRepository.findByUserId(1L)).thenReturn(Optional.of(config));
        when(credentialCryptoService.decrypt("encrypted-key")).thenThrow(new RuntimeException("Decryption error"));

        // When
        ResponseEntity<?> response = controller.getAIConfig();

        // Then
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        assertFalse((Boolean) body.get("success"));
        assertTrue(((String) body.get("message")).contains("获取配置失败"));
    }

    // ==================== 补充测试：覆盖 deleteAIConfig 异常路径 ====================

    @Test
    void deleteAIConfig_FailsWithException() {
        // Given — delete 抛出异常 => 进入 catch 块
        AIConfig config = new AIConfig();
        config.setId(1L);
        config.setUserId(1L);
        config.setModelType("GPT_4");

        when(configRepository.findByUserId(1L)).thenReturn(Optional.of(config));
        doThrow(new RuntimeException("Delete error")).when(configRepository).delete(config);

        // When
        ResponseEntity<?> response = controller.deleteAIConfig();

        // Then
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        assertFalse((Boolean) body.get("success"));
        assertTrue(((String) body.get("message")).contains("删除失败"));
    }

    // ==================== 补充测试：覆盖 testAIConfig fallback 分支 ====================

    @Test
    void testAIConfig_UsesSavedConfigForFallback() throws Exception {
        // Given — 已保存的配置存在，请求中 apiKey/apiEndpoint/customModelName 均为 null
        AIConfig savedConfig = new AIConfig();
        savedConfig.setId(1L);
        savedConfig.setUserId(1L);
        savedConfig.setModelType("GPT_4");
        savedConfig.setApiKey("encrypted-existing-key");
        savedConfig.setApiEndpoint("https://existing.endpoint.com");
        savedConfig.setCustomModelName("existing-model");
        savedConfig.setMaxTokens(2048);

        AIConfigController.AIConfigRequest request = new AIConfigController.AIConfigRequest();
        request.setModelType("GPT_4");
        request.setApiKey(null);
        request.setApiEndpoint(null);
        request.setCustomModelName(null);
        request.setMaxTokens(2048);

        when(configRepository.findByUserId(1L)).thenReturn(Optional.of(savedConfig));
        when(credentialCryptoService.decrypt("encrypted-existing-key")).thenReturn("sk-decrypted");
        when(aiService.generateInsightWithConfig(anyString(), any(AIConfig.class)))
                .thenReturn("Hello");

        // When
        ResponseEntity<?> response = controller.testAIConfig(request);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        assertTrue((Boolean) body.get("success"));
        verify(credentialCryptoService).decrypt("encrypted-existing-key");
    }

    @Test
    void testAIConfig_UsesSavedConfigWhenRequestApiKeyIsBlank() throws Exception {
        // Given — 请求中 apiKey 为空白字符串，应 fallback 到已保存的 key
        AIConfig savedConfig = new AIConfig();
        savedConfig.setId(1L);
        savedConfig.setUserId(1L);
        savedConfig.setModelType("GPT_4");
        savedConfig.setApiKey("encrypted-existing-key");

        AIConfigController.AIConfigRequest request = new AIConfigController.AIConfigRequest();
        request.setModelType("GPT_4");
        request.setApiKey("   "); // 空白字符串
        request.setMaxTokens(2048);

        when(configRepository.findByUserId(1L)).thenReturn(Optional.of(savedConfig));
        when(credentialCryptoService.decrypt("encrypted-existing-key")).thenReturn("sk-decrypted");
        when(aiService.generateInsightWithConfig(anyString(), any(AIConfig.class)))
                .thenReturn("Hello");

        // When
        ResponseEntity<?> response = controller.testAIConfig(request);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        assertTrue((Boolean) body.get("success"));
        verify(credentialCryptoService).decrypt("encrypted-existing-key");
    }
}
