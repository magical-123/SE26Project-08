package com.infodigest.controller;

import com.infodigest.entity.User;
import com.infodigest.entity.UserPlatform;
import com.infodigest.repository.InformationItemRepository;
import com.infodigest.repository.UserPlatformRepository;
import com.infodigest.repository.UserRepository;
import com.infodigest.security.CredentialCryptoService;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;

import java.net.CookieManager;
import java.net.HttpCookie;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SettingsControllerTest {

    @Mock
    private InformationItemRepository informationItemRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private UserPlatformRepository userPlatformRepository;

    @Mock
    private CredentialCryptoService credentialCryptoService;

    @InjectMocks
    private SettingsController controller;

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
        SettingsController.BILI_QR_SESSIONS.clear();
        SettingsController.ZHIHU_QR_SESSIONS.clear();
    }

    @Test
    void getPlatformStatus_ReturnsPlatforms() {
        // Given
        when(userPlatformRepository.findByUserId(1L)).thenReturn(List.of());
        when(informationItemRepository.countByUserIdAndPlatform(1L, "BILIBILI")).thenReturn(0L);
        when(informationItemRepository.countByUserIdAndPlatform(1L, "ZHIHU")).thenReturn(0L);
        when(informationItemRepository.countByUserIdAndPlatform(1L, "XIAOHONGSHU")).thenReturn(0L);
        when(informationItemRepository.countByUserIdAndPlatform(1L, "GITHUB")).thenReturn(0L);

        // When
        ResponseEntity<Map<String, Object>> response = controller.getPlatformStatus();

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertTrue(body.containsKey("platforms"));

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> platforms = (List<Map<String, Object>>) body.get("platforms");
        assertEquals(4, platforms.size());
        assertEquals("bilibili", platforms.get(0).get("key"));
        assertEquals("zhihu", platforms.get(1).get("key"));
        assertEquals("xiaohongshu", platforms.get(2).get("key"));
        assertEquals("github", platforms.get(3).get("key"));
    }

    @Test
    void savePlatformCredential_Succeeds() {
        // Given
        String platform = "GITHUB";
        Map<String, String> request = Map.of("credential", "ghp_token12345");

        when(userPlatformRepository.findByUserIdAndPlatform(1L, "GITHUB")).thenReturn(Optional.empty());
        when(credentialCryptoService.encrypt("ghp_token12345")).thenReturn("encrypted-token");

        // When
        ResponseEntity<Map<String, Object>> response = controller.savePlatformCredential(platform, request);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertTrue((Boolean) body.get("success"));
        assertEquals("GITHUB", body.get("platform"));
        verify(userPlatformRepository).save(any(UserPlatform.class));
    }

    @Test
    void savePlatformCredential_ReturnsBadRequestWhenCredentialNull() {
        // Given
        String platform = "GITHUB";
        Map<String, String> request = Map.of();

        // When
        ResponseEntity<Map<String, Object>> response = controller.savePlatformCredential(platform, request);

        // Then
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertTrue(body.containsKey("error"));
        verify(userPlatformRepository, never()).save(any());
    }

    @Test
    void savePlatformCredential_ReplacesExistingCredential() {
        // Given
        String platform = "BILIBILI";
        Map<String, String> request = Map.of("credential", "new-cookie-string");

        UserPlatform existing = new UserPlatform();
        existing.setId(1L);
        existing.setUserId(1L);
        existing.setPlatform("BILIBILI");
        existing.setCredential("old-encrypted-cookie");

        when(userPlatformRepository.findByUserIdAndPlatform(1L, "BILIBILI")).thenReturn(Optional.of(existing));
        when(credentialCryptoService.encrypt("new-cookie-string")).thenReturn("new-encrypted-cookie");

        // When
        ResponseEntity<Map<String, Object>> response = controller.savePlatformCredential(platform, request);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        verify(userPlatformRepository).delete(existing);
        verify(userPlatformRepository).save(any(UserPlatform.class));
    }

    @Test
    void deletePlatformCredential_Succeeds() {
        // Given
        String platform = "github";

        UserPlatform existing = new UserPlatform();
        existing.setId(1L);
        existing.setUserId(1L);
        existing.setPlatform("GITHUB");

        when(userPlatformRepository.findByUserIdAndPlatform(1L, "GITHUB")).thenReturn(Optional.of(existing));

        // When
        ResponseEntity<Map<String, Object>> response = controller.deletePlatformCredential(platform);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertTrue((Boolean) body.get("success"));
        verify(userPlatformRepository).delete(existing);
    }

    @Test
    void getPlatformDetailedStatus_ReturnsStatus() {
        // Given
        UserPlatform biliPlatform = new UserPlatform();
        biliPlatform.setUserId(1L);
        biliPlatform.setPlatform("BILIBILI");
        biliPlatform.setCredential("encrypted-credential");

        when(userPlatformRepository.findByUserId(1L)).thenReturn(List.of(biliPlatform));
        when(credentialCryptoService.decrypt("encrypted-credential")).thenReturn("sessdata=abc; bili_jct=def; dedeuserid=123");

        // When
        ResponseEntity<Map<String, Object>> response = controller.getPlatformDetailedStatus();

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertTrue(body.containsKey("bilibili"));

        @SuppressWarnings("unchecked")
        Map<String, Object> biliStatus = (Map<String, Object>) body.get("bilibili");
        assertTrue((Boolean) biliStatus.get("connected"));
    }

    // ===== markPlatformCredentialInvalid =====

    @Test
    void markPlatformCredentialInvalid_ForBilibili_MarksExpired() {
        // Given
        String platform = "BILIBILI";
        UserPlatform existing = new UserPlatform();
        existing.setId(1L);
        existing.setUserId(1L);
        existing.setPlatform("BILIBILI");
        existing.setCredential("encrypted-old-credential");

        when(userPlatformRepository.findByUserIdAndPlatform(1L, "BILIBILI")).thenReturn(Optional.of(existing));
        when(credentialCryptoService.encrypt("__INFODIGEST_CREDENTIAL_EXPIRED__")).thenReturn("encrypted-expired-marker");

        // When
        ResponseEntity<Map<String, Object>> response = controller.markPlatformCredentialInvalid(platform, null);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertTrue((Boolean) body.get("success"));
        assertEquals("credential_expired", body.get("status"));
        assertEquals("bilibili", body.get("platform"));
        assertEquals("encrypted-expired-marker", existing.getCredential());
        verify(userPlatformRepository).save(existing);
    }

    @Test
    void markPlatformCredentialInvalid_ForNonBilibiliOrGithub_ReturnsBadRequest() {
        // When
        ResponseEntity<Map<String, Object>> response = controller.markPlatformCredentialInvalid("ZHIHU", null);

        // Then
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertFalse((Boolean) body.get("success"));
        verify(userPlatformRepository, never()).findByUserIdAndPlatform(any(), any());
    }

    @Test
    void markPlatformCredentialInvalid_WithNoExistingRecord() {
        // Given
        when(userPlatformRepository.findByUserIdAndPlatform(1L, "BILIBILI")).thenReturn(Optional.empty());

        // When
        ResponseEntity<Map<String, Object>> response = controller.markPlatformCredentialInvalid("BILIBILI", null);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertTrue((Boolean) body.get("success"));
        assertEquals("disconnected", body.get("status"));
        verify(userPlatformRepository, never()).save(any());
    }

    // ===== deletePlatformCredentialOnly =====

    @Test
    void deletePlatformCredentialOnly_Succeeds() {
        // Given
        String platform = "bilibili";
        UserPlatform existing = new UserPlatform();
        existing.setId(1L);
        existing.setUserId(1L);
        existing.setPlatform("BILIBILI");
        existing.setCredential("encrypted-credential");

        when(userPlatformRepository.findByUserIdAndPlatform(1L, "BILIBILI")).thenReturn(Optional.of(existing));

        // When
        ResponseEntity<Map<String, Object>> response = controller.deletePlatformCredentialOnly(platform);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertTrue((Boolean) body.get("success"));
        verify(userPlatformRepository).delete(existing);
        // credentialCryptoService 不应被调用
        verifyNoInteractions(credentialCryptoService);
    }

    // ===== getUserCredentials =====

    @Test
    void getUserCredentials_ReturnsDecryptedCredentials() {
        // Given
        UserPlatform github = new UserPlatform();
        github.setUserId(1L);
        github.setPlatform("GITHUB");
        github.setCredential("encrypted-github");

        when(userPlatformRepository.findByUserId(1L)).thenReturn(List.of(github));
        when(credentialCryptoService.decrypt("encrypted-github")).thenReturn("ghp_token12345");

        // When
        ResponseEntity<Map<String, Object>> response = controller.getUserCredentials();

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertTrue(body.containsKey("github"));

        @SuppressWarnings("unchecked")
        Map<String, Object> githubCred = (Map<String, Object>) body.get("github");
        assertEquals("ghp_token12345", githubCred.get("credential"));
    }

    @Test
    void getUserCredentials_SkipsInvalidBilibiliCredential() {
        // Given
        UserPlatform bili = new UserPlatform();
        bili.setUserId(1L);
        bili.setPlatform("BILIBILI");
        bili.setCredential("encrypted-bili");

        when(userPlatformRepository.findByUserId(1L)).thenReturn(List.of(bili));
        when(credentialCryptoService.decrypt("encrypted-bili")).thenReturn("invalid-cookie-without-required-fields");

        // When
        ResponseEntity<Map<String, Object>> response = controller.getUserCredentials();

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertFalse(body.containsKey("bilibili"));
    }

    @Test
    void getUserCredentials_HandlesDecryptionException() {
        // Given
        UserPlatform github = new UserPlatform();
        github.setUserId(1L);
        github.setPlatform("GITHUB");
        github.setCredential("corrupted-encrypted");

        when(userPlatformRepository.findByUserId(1L)).thenReturn(List.of(github));
        when(credentialCryptoService.decrypt("corrupted-encrypted")).thenThrow(new RuntimeException("Decryption failed"));

        // When
        ResponseEntity<Map<String, Object>> response = controller.getUserCredentials();

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertTrue(body.isEmpty());
    }

    // ===== getPlatformStatus =====

    @Test
    void getPlatformStatus_WithConnectedBilibiliAndGithub() {
        // Given
        UserPlatform biliPlatform = new UserPlatform();
        biliPlatform.setUserId(1L);
        biliPlatform.setPlatform("BILIBILI");
        biliPlatform.setCredential("encrypted-bili");

        UserPlatform githubPlatform = new UserPlatform();
        githubPlatform.setUserId(1L);
        githubPlatform.setPlatform("GITHUB");
        githubPlatform.setCredential("encrypted-github");

        when(userPlatformRepository.findByUserId(1L)).thenReturn(List.of(biliPlatform, githubPlatform));
        when(informationItemRepository.countByUserIdAndPlatform(1L, "BILIBILI")).thenReturn(5L);
        when(informationItemRepository.countByUserIdAndPlatform(1L, "ZHIHU")).thenReturn(0L);
        when(informationItemRepository.countByUserIdAndPlatform(1L, "XIAOHONGSHU")).thenReturn(0L);
        when(informationItemRepository.countByUserIdAndPlatform(1L, "GITHUB")).thenReturn(3L);
        when(credentialCryptoService.decrypt("encrypted-bili")).thenReturn("sessdata=abc; bili_jct=def; dedeuserid=123");
        when(credentialCryptoService.decrypt("encrypted-github")).thenReturn("ghp_token12345");

        // When
        ResponseEntity<Map<String, Object>> response = controller.getPlatformStatus();

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> platforms = (List<Map<String, Object>>) body.get("platforms");
        assertEquals(4, platforms.size());

        // Bilibili connected
        assertTrue((Boolean) platforms.get(0).get("connected"));
        assertFalse((Boolean) platforms.get(0).get("needsReauth"));

        // Zhihu not connected
        assertFalse((Boolean) platforms.get(1).get("connected"));

        // Xiaohongshu not connected
        assertFalse((Boolean) platforms.get(2).get("connected"));

        // GitHub connected
        assertTrue((Boolean) platforms.get(3).get("connected"));
        assertFalse((Boolean) platforms.get(3).get("needsReauth"));
    }

    // ===== getPlatformDetailedStatus =====

    @Test
    void getPlatformDetailedStatus_WithGitHubPlatform() {
        // Given
        UserPlatform githubPlatform = new UserPlatform();
        githubPlatform.setUserId(1L);
        githubPlatform.setPlatform("GITHUB");
        githubPlatform.setCredential("encrypted-github");

        when(userPlatformRepository.findByUserId(1L)).thenReturn(List.of(githubPlatform));
        when(credentialCryptoService.decrypt("encrypted-github")).thenReturn("ghp_token12345");

        // When
        ResponseEntity<Map<String, Object>> response = controller.getPlatformDetailedStatus();

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertTrue(body.containsKey("github"));

        @SuppressWarnings("unchecked")
        Map<String, Object> githubStatus = (Map<String, Object>) body.get("github");
        assertTrue((Boolean) githubStatus.get("connected"));
        assertFalse((Boolean) githubStatus.get("needsReauth"));
        assertEquals("github", githubStatus.get("platform"));
    }

    @Test
    void getPlatformDetailedStatus_WithNoPlatforms() {
        // Given
        when(userPlatformRepository.findByUserId(1L)).thenReturn(List.of());

        // When
        ResponseEntity<Map<String, Object>> response = controller.getPlatformDetailedStatus();

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertTrue(body.isEmpty());
    }

    // ===== getPlatformStatus - needsReauth paths =====

    @Test
    void getPlatformStatus_WithExpiredBilibiliCredential_ShowsNeedsReauth() {
        // Given - BILIBILI platform exists but credential is unusable (decryption failure)
        UserPlatform biliPlatform = new UserPlatform();
        biliPlatform.setUserId(1L);
        biliPlatform.setPlatform("BILIBILI");
        biliPlatform.setCredential("encrypted-expired");

        when(userPlatformRepository.findByUserId(1L)).thenReturn(List.of(biliPlatform));
        when(informationItemRepository.countByUserIdAndPlatform(1L, "BILIBILI")).thenReturn(0L);
        when(informationItemRepository.countByUserIdAndPlatform(1L, "ZHIHU")).thenReturn(0L);
        when(informationItemRepository.countByUserIdAndPlatform(1L, "XIAOHONGSHU")).thenReturn(0L);
        when(informationItemRepository.countByUserIdAndPlatform(1L, "GITHUB")).thenReturn(0L);
        when(credentialCryptoService.decrypt("encrypted-expired")).thenThrow(new RuntimeException("Decryption failed"));

        // When
        ResponseEntity<Map<String, Object>> response = controller.getPlatformStatus();

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        List<Map<String, Object>> platforms = (List<Map<String, Object>>) response.getBody().get("platforms");
        Map<String, Object> bilibili = platforms.get(0);
        assertFalse((Boolean) bilibili.get("connected"));
        assertTrue((Boolean) bilibili.get("needsReauth"));
    }

    @Test
    void getPlatformStatus_WithExpiredGithubCredential_ShowsNeedsReauth() {
        // Given - GITHUB platform exists but credential is expired marker
        UserPlatform githubPlatform = new UserPlatform();
        githubPlatform.setUserId(1L);
        githubPlatform.setPlatform("GITHUB");
        githubPlatform.setCredential("encrypted-expired");

        when(userPlatformRepository.findByUserId(1L)).thenReturn(List.of(githubPlatform));
        when(informationItemRepository.countByUserIdAndPlatform(1L, "BILIBILI")).thenReturn(0L);
        when(informationItemRepository.countByUserIdAndPlatform(1L, "ZHIHU")).thenReturn(0L);
        when(informationItemRepository.countByUserIdAndPlatform(1L, "XIAOHONGSHU")).thenReturn(0L);
        when(informationItemRepository.countByUserIdAndPlatform(1L, "GITHUB")).thenReturn(0L);
        when(credentialCryptoService.decrypt("encrypted-expired")).thenReturn("__INFODIGEST_CREDENTIAL_EXPIRED__");

        // When
        ResponseEntity<Map<String, Object>> response = controller.getPlatformStatus();

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        List<Map<String, Object>> platforms = (List<Map<String, Object>>) response.getBody().get("platforms");
        Map<String, Object> github = platforms.get(3);
        assertFalse((Boolean) github.get("connected"));
        assertTrue((Boolean) github.get("needsReauth"));
    }

    // ===== markPlatformCredentialInvalid - GitHub and withReason =====

    @Test
    void markPlatformCredentialInvalid_ForGithubWithReason() {
        // Given
        String platform = "GITHUB";
        UserPlatform existing = new UserPlatform();
        existing.setId(1L);
        existing.setUserId(1L);
        existing.setPlatform("GITHUB");
        existing.setCredential("encrypted-old-token");

        when(userPlatformRepository.findByUserIdAndPlatform(1L, "GITHUB")).thenReturn(Optional.of(existing));
        when(credentialCryptoService.encrypt("__INFODIGEST_CREDENTIAL_EXPIRED__")).thenReturn("encrypted-expired-marker");

        // When
        ResponseEntity<Map<String, Object>> response = controller.markPlatformCredentialInvalid(
                platform, Map.of("reason", "Token 401"));

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertTrue((Boolean) body.get("success"));
        assertEquals("credential_expired", body.get("status"));
        assertEquals("github", body.get("platform"));
        assertTrue(((String) body.get("message")).contains("GitHub"));
        assertEquals("Token 401", body.get("reason"));
        verify(userPlatformRepository).save(existing);
    }

    @Test
    void markPlatformCredentialInvalid_ForGithubWithNoExistingRecord() {
        // Given
        when(userPlatformRepository.findByUserIdAndPlatform(1L, "GITHUB")).thenReturn(Optional.empty());

        // When
        ResponseEntity<Map<String, Object>> response = controller.markPlatformCredentialInvalid("GITHUB", null);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertTrue((Boolean) body.get("success"));
        assertEquals("disconnected", body.get("status"));
    }

    // ===== Private method tests via ReflectionTestUtils =====

    @Test
    void parseJson_ReturnsMapForValidJson() {
        String json = "{\"code\":0,\"data\":{\"key\":\"value\"}}";
        Map<String, Object> result = ReflectionTestUtils.invokeMethod(controller, "parseJson", json);
        assertNotNull(result);
        assertEquals(0, result.get("code"));
    }

    @Test
    void parseJson_ReturnsNullForInvalidJson() {
        String json = "not-json";
        Map<String, Object> result = ReflectionTestUtils.invokeMethod(controller, "parseJson", json);
        assertNull(result);
    }

    @Test
    void buildErrorResponse_Returns502WithMessage() {
        ResponseEntity<Map<String, Object>> response = ReflectionTestUtils.invokeMethod(
                controller, "buildErrorResponse", "test error message");
        assertNotNull(response);
        assertEquals(502, response.getStatusCode().value());
        assertTrue(response.getBody().get("error").toString().contains("test error message"));
    }

    @Test
    void cleanExpiredBilibiliSessions_DoesNotThrow() {
        ReflectionTestUtils.invokeMethod(controller, "cleanExpiredBilibiliSessions");
        // No exception means success
    }

    @Test
    void cleanExpiredZhihuSessions_DoesNotThrow() {
        ReflectionTestUtils.invokeMethod(controller, "cleanExpiredZhihuSessions");
    }

    @Test
    void extractCookies_ReturnsEmptyForEmptyCookieManager() {
        CookieManager cookieManager = new CookieManager();
        String result = ReflectionTestUtils.invokeMethod(controller, "extractCookies", cookieManager);
        assertEquals("", result);
    }

    @Test
    void extractCookies_ReturnsFormattedCookies() {
        CookieManager cookieManager = new CookieManager();
        HttpCookie cookie = new HttpCookie("test_name", "test_value");
        cookieManager.getCookieStore().add(URI.create("https://example.com"), cookie);

        String result = ReflectionTestUtils.invokeMethod(controller, "extractCookies", cookieManager);
        assertEquals("test_name=test_value", result);
    }

    @Test
    void extractBilibiliCookies_WithNullLoginUrl_ReturnsCookieStoreCookies() {
        CookieManager cookieManager = new CookieManager();
        HttpCookie cookie = new HttpCookie("SESSDATA", "abc123");
        cookieManager.getCookieStore().add(URI.create("https://www.bilibili.com"), cookie);

        String result = ReflectionTestUtils.invokeMethod(
                controller, "extractBilibiliCookies", cookieManager, (String) null);
        assertNotNull(result);
        assertTrue(result.contains("SESSDATA=abc123"));
    }

    @Test
    void saveBilibiliCredential_SavesEncryptedCookie() {
        String cookieStr = "sessdata=abc; bili_jct=def; dedeuserid=123";

        when(userPlatformRepository.findByUserIdAndPlatform(1L, "BILIBILI")).thenReturn(Optional.empty());
        when(credentialCryptoService.encrypt(cookieStr)).thenReturn("encrypted-cookie");
        when(credentialCryptoService.decrypt("encrypted-cookie")).thenReturn(cookieStr);

        ReflectionTestUtils.invokeMethod(controller, "saveBilibiliCredential", cookieStr);

        verify(credentialCryptoService).encrypt(cookieStr);
        verify(credentialCryptoService).decrypt("encrypted-cookie");
        verify(userPlatformRepository).save(any(UserPlatform.class));
    }

    @Test
    void saveBilibiliCredential_DeletesExistingBeforeSave() {
        String cookieStr = "sessdata=abc; bili_jct=def; dedeuserid=123";
        UserPlatform existing = new UserPlatform();
        existing.setId(1L);
        existing.setUserId(1L);
        existing.setPlatform("BILIBILI");

        when(userPlatformRepository.findByUserIdAndPlatform(1L, "BILIBILI")).thenReturn(Optional.of(existing));
        when(credentialCryptoService.encrypt(cookieStr)).thenReturn("encrypted-cookie");
        when(credentialCryptoService.decrypt("encrypted-cookie")).thenReturn(cookieStr);

        ReflectionTestUtils.invokeMethod(controller, "saveBilibiliCredential", cookieStr);

        verify(userPlatformRepository).delete(existing);
        verify(userPlatformRepository).save(any(UserPlatform.class));
    }

    @Test
    void saveZhihuCredential_SavesEncryptedCookie() {
        String cookieStr = "d_c0=abc123";

        when(userPlatformRepository.findByUserIdAndPlatform(1L, "ZHIHU")).thenReturn(Optional.empty());
        when(credentialCryptoService.encrypt(cookieStr)).thenReturn("encrypted-cookie");

        ReflectionTestUtils.invokeMethod(controller, "saveZhihuCredential", cookieStr);

        verify(credentialCryptoService).encrypt(cookieStr);
        verify(userPlatformRepository).save(any(UserPlatform.class));
    }

    @Test
    void saveZhihuCredential_DeletesExistingBeforeSave() {
        String cookieStr = "d_c0=abc123";
        UserPlatform existing = new UserPlatform();
        existing.setId(1L);
        existing.setUserId(1L);
        existing.setPlatform("ZHIHU");

        when(userPlatformRepository.findByUserIdAndPlatform(1L, "ZHIHU")).thenReturn(Optional.of(existing));
        when(credentialCryptoService.encrypt(cookieStr)).thenReturn("encrypted-cookie");

        ReflectionTestUtils.invokeMethod(controller, "saveZhihuCredential", cookieStr);

        verify(userPlatformRepository).delete(existing);
        verify(userPlatformRepository).save(any(UserPlatform.class));
    }

    // ===== QR Code tests (using spy to mock executeHttpRequest) =====

    @Test
    void getBilibiliQrcode_Success() throws Exception {
        // Given
        SettingsController spy = spy(controller);
        HttpResponse<String> mockResponse = mock(HttpResponse.class);
        when(mockResponse.body()).thenReturn("{\"code\":0,\"data\":{\"qrcode_key\":\"test_key\",\"url\":\"https://bilibili.com/qr/abc\"}}");
        doReturn(mockResponse).when(spy).executeHttpRequest(any(), any());

        // When
        ResponseEntity<Map<String, Object>> response = spy.getBilibiliQrcode();

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("test_key", response.getBody().get("qrcodeKey"));
        assertEquals("https://bilibili.com/qr/abc", response.getBody().get("qrcodeUrl"));
    }

    @Test
    void getBilibiliQrcode_ApiError_Returns502() throws Exception {
        // Given
        SettingsController spy = spy(controller);
        HttpResponse<String> mockResponse = mock(HttpResponse.class);
        when(mockResponse.body()).thenReturn("{\"code\":-1,\"message\":\"error\"}");
        doReturn(mockResponse).when(spy).executeHttpRequest(any(), any());

        // When
        ResponseEntity<Map<String, Object>> response = spy.getBilibiliQrcode();

        // Then
        assertEquals(502, response.getStatusCode().value());
        assertTrue(response.getBody().get("error").toString().contains("异常"));
    }

    @Test
    void getBilibiliQrcode_HttpException_Returns502() throws Exception {
        // Given
        SettingsController spy = spy(controller);
        doThrow(new RuntimeException("Connection timeout")).when(spy).executeHttpRequest(any(), any());

        // When
        ResponseEntity<Map<String, Object>> response = spy.getBilibiliQrcode();

        // Then
        assertEquals(502, response.getStatusCode().value());
    }

    @Test
    void pollBilibiliQrcode_SessionExpired_Returns502() {
        // When - no session in map
        ResponseEntity<Map<String, Object>> response = controller.pollBilibiliQrcode("nonexistent_key");

        // Then
        assertEquals(502, response.getStatusCode().value());
        assertTrue(response.getBody().get("error").toString().contains("过期"));
    }

    @Test
    void pollBilibiliQrcode_WaitingForScan() throws Exception {
        // Given
        SettingsController.BILI_QR_SESSIONS.put("test_key",
                new SettingsController.QrSession("test_key", mock(HttpClient.class), new CookieManager()));
        SettingsController spy = spy(controller);
        HttpResponse<String> mockResponse = mock(HttpResponse.class);
        when(mockResponse.body()).thenReturn("{\"data\":{\"code\":86101}}");
        doReturn(mockResponse).when(spy).executeHttpRequest(any(), any());

        // When
        ResponseEntity<Map<String, Object>> response = spy.pollBilibiliQrcode("test_key");

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(-1, response.getBody().get("status"));
    }

    @Test
    void pollBilibiliQrcode_QrcodeExpired() throws Exception {
        // Given
        SettingsController.BILI_QR_SESSIONS.put("test_key",
                new SettingsController.QrSession("test_key", mock(HttpClient.class), new CookieManager()));
        SettingsController spy = spy(controller);
        HttpResponse<String> mockResponse = mock(HttpResponse.class);
        when(mockResponse.body()).thenReturn("{\"data\":{\"code\":86038}}");
        doReturn(mockResponse).when(spy).executeHttpRequest(any(), any());

        // When
        ResponseEntity<Map<String, Object>> response = spy.pollBilibiliQrcode("test_key");

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(2, response.getBody().get("status"));
    }

    @Test
    void getZhihuQrcode_Success() throws Exception {
        // Given
        SettingsController spy = spy(controller);
        HttpResponse<String> udidResponse = mock(HttpResponse.class);
        when(udidResponse.body()).thenReturn("{}");
        HttpResponse<String> tokenResponse = mock(HttpResponse.class);
        when(tokenResponse.body()).thenReturn("{\"token\":\"zhihu_test_token\",\"link\":\"https://zhihu.com/qr\"}");
        doReturn(udidResponse, tokenResponse).when(spy).executeHttpRequest(any(), any());

        // When
        ResponseEntity<Map<String, Object>> response = spy.getZhihuQrcode();

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody().get("qrcodeKey"));
        assertEquals("zhihu_test_token", response.getBody().get("qrcodeKey"));
    }

    @Test
    void pollZhihuQrcode_SessionExpired_Returns502() {
        // When
        ResponseEntity<Map<String, Object>> response = controller.pollZhihuQrcode("nonexistent_key");

        // Then
        assertEquals(502, response.getStatusCode().value());
        assertTrue(response.getBody().get("error").toString().contains("过期"));
    }

    @Test
    void pollZhihuQrcode_Waiting() throws Exception {
        // Given
        SettingsController.ZHIHU_QR_SESSIONS.put("test_key",
                new SettingsController.ZhihuQrSession("test_key", mock(HttpClient.class), new CookieManager()));
        SettingsController spy = spy(controller);
        HttpResponse<String> mockResponse = mock(HttpResponse.class);
        when(mockResponse.body()).thenReturn("{\"status\":0}");
        doReturn(mockResponse).when(spy).executeHttpRequest(any(), any());

        // When
        ResponseEntity<Map<String, Object>> response = spy.pollZhihuQrcode("test_key");

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(-1, response.getBody().get("status")); // 0 → -1 (waiting)
    }

    @Test
    void pollZhihuQrcode_Scanned() throws Exception {
        // Given
        SettingsController.ZHIHU_QR_SESSIONS.put("test_key",
                new SettingsController.ZhihuQrSession("test_key", mock(HttpClient.class), new CookieManager()));
        SettingsController spy = spy(controller);
        HttpResponse<String> mockResponse = mock(HttpResponse.class);
        when(mockResponse.body()).thenReturn("{\"status\":1}");
        doReturn(mockResponse).when(spy).executeHttpRequest(any(), any());

        // When
        ResponseEntity<Map<String, Object>> response = spy.pollZhihuQrcode("test_key");

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(0, response.getBody().get("status")); // 1 → 0 (scanned)
    }

    // ===== pollBilibiliQrcode - additional branch coverage =====

    @Test
    void pollBilibiliQrcode_Success() throws Exception {
        // Given - CookieManager with all required bilibili cookies
        CookieManager cookieManager = new CookieManager();
        cookieManager.getCookieStore().add(URI.create("https://www.bilibili.com"), new HttpCookie("SESSDATA", "abc123"));
        cookieManager.getCookieStore().add(URI.create("https://www.bilibili.com"), new HttpCookie("bili_jct", "def456"));
        cookieManager.getCookieStore().add(URI.create("https://www.bilibili.com"), new HttpCookie("DedeUserID", "12345"));

        SettingsController.BILI_QR_SESSIONS.put("test_key",
                new SettingsController.QrSession("test_key", mock(HttpClient.class), cookieManager));
        SettingsController spy = spy(controller);
        HttpResponse<String> mockResponse = mock(HttpResponse.class);
        when(mockResponse.body()).thenReturn("{\"data\":{\"code\":0}}");
        doReturn(mockResponse).when(spy).executeHttpRequest(any(), any());

        // Mock saveBilibiliCredential dependencies
        when(userPlatformRepository.findByUserIdAndPlatform(1L, "BILIBILI")).thenReturn(Optional.empty());
        when(credentialCryptoService.encrypt(any())).thenReturn("encrypted-cookie");
        when(credentialCryptoService.decrypt("encrypted-cookie")).thenReturn("SESSDATA=abc123; bili_jct=def456; DedeUserID=12345");

        // When
        ResponseEntity<Map<String, Object>> response = spy.pollBilibiliQrcode("test_key");

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(1, response.getBody().get("status"));
        assertTrue((Boolean) response.getBody().get("success"));
        assertNull(SettingsController.BILI_QR_SESSIONS.get("test_key"));
        verify(credentialCryptoService).encrypt(any());
    }

    @Test
    void pollBilibiliQrcode_NullBody() throws Exception {
        // Given - parseJson returns null
        SettingsController.BILI_QR_SESSIONS.put("test_key",
                new SettingsController.QrSession("test_key", mock(HttpClient.class), new CookieManager()));
        SettingsController spy = spy(controller);
        HttpResponse<String> mockResponse = mock(HttpResponse.class);
        when(mockResponse.body()).thenReturn("not-json");
        doReturn(mockResponse).when(spy).executeHttpRequest(any(), any());

        // When
        ResponseEntity<Map<String, Object>> response = spy.pollBilibiliQrcode("test_key");

        // Then
        assertEquals(502, response.getStatusCode().value());
        assertTrue(response.getBody().get("error").toString().contains("异常"));
    }

    // ===== getBilibiliQrcode - null qrcodeKey branch =====

    @Test
    void getBilibiliQrcode_NullQrcodeKey() throws Exception {
        // Given - API returns data but qrcode_key is null
        SettingsController spy = spy(controller);
        HttpResponse<String> mockResponse = mock(HttpResponse.class);
        when(mockResponse.body()).thenReturn("{\"code\":0,\"data\":{\"qrcode_key\":null,\"url\":\"https://bilibili.com/qr/abc\"}}");
        doReturn(mockResponse).when(spy).executeHttpRequest(any(), any());

        // When
        ResponseEntity<Map<String, Object>> response = spy.getBilibiliQrcode();

        // Then
        assertEquals(502, response.getStatusCode().value());
        assertTrue(response.getBody().get("error").toString().contains("字段缺失"));
    }

    // ===== pollZhihuQrcode - login success (status=2) =====

    @Test
    void pollZhihuQrcode_LoginSuccess() throws Exception {
        // Given - status=2 with cookies in CookieManager
        CookieManager cookieManager = new CookieManager();
        cookieManager.getCookieStore().add(URI.create("https://www.zhihu.com"), new HttpCookie("d_c0", "abc123"));

        SettingsController.ZHIHU_QR_SESSIONS.put("test_key",
                new SettingsController.ZhihuQrSession("test_key", mock(HttpClient.class), cookieManager));
        SettingsController spy = spy(controller);
        HttpResponse<String> mockResponse = mock(HttpResponse.class);
        when(mockResponse.body()).thenReturn("{\"status\":2}");
        doReturn(mockResponse).when(spy).executeHttpRequest(any(), any());

        // Mock saveZhihuCredential dependencies
        when(userPlatformRepository.findByUserIdAndPlatform(1L, "ZHIHU")).thenReturn(Optional.empty());
        when(credentialCryptoService.encrypt(any())).thenReturn("encrypted-cookie");

        // When
        ResponseEntity<Map<String, Object>> response = spy.pollZhihuQrcode("test_key");

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(1, response.getBody().get("status"));
        assertTrue((Boolean) response.getBody().get("success"));
        assertNull(SettingsController.ZHIHU_QR_SESSIONS.get("test_key"));
        verify(credentialCryptoService).encrypt(any());
    }

    // ===== getUserCredentials - bilibili with usable credential =====

    @Test
    void getUserCredentials_ReturnsBilibiliCredential() {
        // Given - bilibili platform with valid cookie credential
        UserPlatform bili = new UserPlatform();
        bili.setUserId(1L);
        bili.setPlatform("BILIBILI");
        bili.setCredential("encrypted-bili");

        when(userPlatformRepository.findByUserId(1L)).thenReturn(List.of(bili));
        when(credentialCryptoService.decrypt("encrypted-bili")).thenReturn("sessdata=abc; bili_jct=def; dedeuserid=123");

        // When
        ResponseEntity<Map<String, Object>> response = controller.getUserCredentials();

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertTrue(body.containsKey("bilibili"));

        @SuppressWarnings("unchecked")
        Map<String, Object> biliCred = (Map<String, Object>) body.get("bilibili");
        assertEquals("sessdata=abc; bili_jct=def; dedeuserid=123", biliCred.get("credential"));
    }

    // ===== executeHttpRequest 真实执行（本地 HTTP 服务器） =====

    @Test
    void executeHttpRequest_RealHttpCall_ReturnsResponse() throws Exception {
        // Given
        HttpServer server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/test", exchange -> {
            byte[] resp = "hello world".getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200, resp.length);
            exchange.getResponseBody().write(resp);
            exchange.close();
        });
        server.start();
        try {
            int port = server.getAddress().getPort();
            HttpClient client = HttpClient.newHttpClient();
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("http://localhost:" + port + "/test"))
                    .GET()
                    .build();

            // When
            HttpResponse<String> response = controller.executeHttpRequest(client, request);

            // Then
            assertEquals(200, response.statusCode());
            assertEquals("hello world", response.body());
        } finally {
            server.stop(0);
        }
    }

    // ===== extractBilibiliCookies 分支 =====

    @Test
    void extractBilibiliCookies_MergesUrlQueryCookies() {
        // Given
        CookieManager cookieManager = new CookieManager();
        try {
            cookieManager.getCookieStore().add(
                    URI.create("https://www.bilibili.com"), new HttpCookie("SESSDATA", "fromStore"));
        } catch (Exception ignored) {
        }
        String loginUrl = "https://passport.bilibili.com/login"
                + "?DedeUserID=123&DedeUserID__ckMd5=abc&SESSDATA=fromUrl&bili_jct=token&other=skip";

        // When
        String result = ReflectionTestUtils.invokeMethod(
                controller, "extractBilibiliCookies", cookieManager, loginUrl);

        // Then: 允许的字段被合并，store 中的值优先（putIfAbsent），非允许字段被跳过
        assertNotNull(result);
        assertTrue(result.contains("DedeUserID=123"));
        assertTrue(result.contains("DedeUserID__ckMd5=abc"));
        assertTrue(result.contains("SESSDATA=fromStore"));
        assertFalse(result.contains("fromUrl"));
        assertTrue(result.contains("bili_jct=token"));
        assertFalse(result.contains("other=skip"));
    }

    @Test
    void extractBilibiliCookies_NullLoginUrl_UsesStoreOnly() {
        // Given
        CookieManager cookieManager = new CookieManager();
        try {
            cookieManager.getCookieStore().add(
                    URI.create("https://www.bilibili.com"), new HttpCookie("bili_jct", "token"));
        } catch (Exception ignored) {
        }

        // When
        String result = ReflectionTestUtils.invokeMethod(
                controller, "extractBilibiliCookies", cookieManager, (Object) null);

        // Then
        assertNotNull(result);
        assertTrue(result.contains("bili_jct=token"));
    }

    @Test
    void extractBilibiliCookies_BlankLoginUrl_UsesStoreOnly() {
        // Given
        CookieManager cookieManager = new CookieManager();

        // When
        String result = ReflectionTestUtils.invokeMethod(
                controller, "extractBilibiliCookies", cookieManager, "   ");

        // Then
        assertNotNull(result);
        assertTrue(result.isEmpty());
    }

    @Test
    void extractBilibiliCookies_InvalidLoginUrl_FallsBackToStore() {
        // Given
        CookieManager cookieManager = new CookieManager();
        try {
            cookieManager.getCookieStore().add(
                    URI.create("https://www.bilibili.com"), new HttpCookie("bili_jct", "token"));
        } catch (Exception ignored) {
        }
        String invalidUrl = "http://[invalid";

        // When
        String result = ReflectionTestUtils.invokeMethod(
                controller, "extractBilibiliCookies", cookieManager, invalidUrl);

        // Then: IllegalArgumentException 被捕获，退回 CookieStore
        assertNotNull(result);
        assertTrue(result.contains("bili_jct=token"));
    }

    @Test
    void extractBilibiliCookies_SkipsPairsWithoutSeparator() {
        // Given
        CookieManager cookieManager = new CookieManager();
        String loginUrl = "https://passport.bilibili.com/login?a=1&noequals&DedeUserID=123";

        // When
        String result = ReflectionTestUtils.invokeMethod(
                controller, "extractBilibiliCookies", cookieManager, loginUrl);

        // Then: 无 "=" 的 pair 被跳过，DedeUserID 被合并
        assertNotNull(result);
        assertTrue(result.contains("DedeUserID=123"));
        assertFalse(result.contains("noequals"));
    }

    // ===== getZhihuQrcode 分支 =====

    @Test
    void getZhihuQrcode_TokenBodyNull_Returns502() throws Exception {
        // Given
        SettingsController spy = spy(controller);
        HttpResponse<String> mockResponse = mock(HttpResponse.class);
        when(mockResponse.body()).thenReturn("not-json");
        doReturn(mockResponse).when(spy).executeHttpRequest(any(), any());

        // When
        ResponseEntity<Map<String, Object>> response = spy.getZhihuQrcode();

        // Then
        assertEquals(502, response.getStatusCode().value());
        assertTrue(response.getBody().get("error").toString().contains("token"));
    }

    @Test
    void getZhihuQrcode_TokenEmpty_Returns502() throws Exception {
        // Given
        SettingsController spy = spy(controller);
        HttpResponse<String> mockResponse = mock(HttpResponse.class);
        when(mockResponse.body()).thenReturn("{\"token\":\"\",\"link\":\"x\"}");
        doReturn(mockResponse).when(spy).executeHttpRequest(any(), any());

        // When
        ResponseEntity<Map<String, Object>> response = spy.getZhihuQrcode();

        // Then
        assertEquals(502, response.getStatusCode().value());
        assertTrue(response.getBody().get("error").toString().contains("token 为空"));
    }

    @Test
    void getZhihuQrcode_LinkMissing_UsesFallback() throws Exception {
        // Given
        SettingsController spy = spy(controller);
        HttpResponse<String> mockResponse = mock(HttpResponse.class);
        when(mockResponse.body()).thenReturn("{\"token\":\"tok123\"}");
        doReturn(mockResponse).when(spy).executeHttpRequest(any(), any());

        // When
        ResponseEntity<Map<String, Object>> response = spy.getZhihuQrcode();

        // Then: link 缺失时使用兜底 URL
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("tok123", response.getBody().get("qrcodeKey"));
        assertEquals("https://www.zhihu.com/account/scan/login/tok123", response.getBody().get("qrcodeLink"));
        assertNotNull(SettingsController.ZHIHU_QR_SESSIONS.get("tok123"));
    }

    // ===== pollZhihuQrcode 分支 =====

    @Test
    void pollZhihuQrcode_ParseNullBody_Returns502() throws Exception {
        // Given
        SettingsController.ZHIHU_QR_SESSIONS.put("test_key",
                new SettingsController.ZhihuQrSession("test_key", mock(HttpClient.class), new CookieManager()));
        SettingsController spy = spy(controller);
        HttpResponse<String> mockResponse = mock(HttpResponse.class);
        when(mockResponse.body()).thenReturn("not-json");
        doReturn(mockResponse).when(spy).executeHttpRequest(any(), any());

        // When
        ResponseEntity<Map<String, Object>> response = spy.pollZhihuQrcode("test_key");

        // Then
        assertEquals(502, response.getStatusCode().value());
        assertTrue(response.getBody().get("error").toString().contains("异常"));
    }

    @Test
    void pollZhihuQrcode_StatusAsString_Waiting() throws Exception {
        // Given
        SettingsController.ZHIHU_QR_SESSIONS.put("test_key",
                new SettingsController.ZhihuQrSession("test_key", mock(HttpClient.class), new CookieManager()));
        SettingsController spy = spy(controller);
        HttpResponse<String> mockResponse = mock(HttpResponse.class);
        when(mockResponse.body()).thenReturn("{\"status\":\"0\"}");
        doReturn(mockResponse).when(spy).executeHttpRequest(any(), any());

        // When
        ResponseEntity<Map<String, Object>> response = spy.pollZhihuQrcode("test_key");

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(-1, response.getBody().get("status"));
        assertFalse((Boolean) response.getBody().get("success"));
    }

    @Test
    void pollZhihuQrcode_StatusAsString_InvalidNumber_TreatedAsExpired() throws Exception {
        // Given
        SettingsController.ZHIHU_QR_SESSIONS.put("test_key",
                new SettingsController.ZhihuQrSession("test_key", mock(HttpClient.class), new CookieManager()));
        SettingsController spy = spy(controller);
        HttpResponse<String> mockResponse = mock(HttpResponse.class);
        when(mockResponse.body()).thenReturn("{\"status\":\"abc\"}");
        doReturn(mockResponse).when(spy).executeHttpRequest(any(), any());

        // When
        ResponseEntity<Map<String, Object>> response = spy.pollZhihuQrcode("test_key");

        // Then: NumberFormatException 被忽略，scanStatus 保持 -1 之外的默认分支 → 过期
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(2, response.getBody().get("status"));
    }

    // ===== getCurrentUserId 用户不存在 =====

    @Test
    void getPlatformStatus_UserNotFound_Throws() {
        // Given
        when(userRepository.findByUsername("testuser")).thenReturn(Optional.empty());

        // When & Then
        assertThrows(RuntimeException.class, () -> controller.getPlatformStatus());
    }
}
