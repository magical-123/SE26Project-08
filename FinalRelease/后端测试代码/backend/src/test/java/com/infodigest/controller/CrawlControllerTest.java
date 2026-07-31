package com.infodigest.controller;

import com.infodigest.entity.User;
import com.infodigest.entity.UserPlatform;
import com.infodigest.repository.UserPlatformRepository;
import com.infodigest.repository.UserRepository;
import com.infodigest.security.CredentialCryptoService;
import com.infodigest.security.JwtUtil;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;

import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CrawlControllerTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private JwtUtil jwtUtil;

    @Mock
    private UserPlatformRepository userPlatformRepository;

    @Mock
    private CredentialCryptoService credentialCryptoService;

    @Mock
    private RestTemplate restTemplate;

    @InjectMocks
    private CrawlController controller;

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    private void setupAuthenticatedUser() {
        User currentUser = new User();
        currentUser.setId(1L);
        currentUser.setUsername("testuser");
        when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(currentUser));
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("testuser", null));
        ReflectionTestUtils.setField(controller, "crawlerScriptPath", "echo");
        ReflectionTestUtils.setField(controller, "restTemplate", restTemplate);
        lenient().when(restTemplate.postForObject(anyString(), any(), eq(Map.class))).thenReturn(Map.of());
    }

    @Test
    void triggerCrawl_ReturnsStartedForBilibili() {
        // Given
        setupAuthenticatedUser();
        String platform = "bilibili";
        UserPlatform credential = new UserPlatform();
        credential.setUserId(1L);
        credential.setPlatform("BILIBILI");
        credential.setCredential("encrypted-cookie");

        when(userPlatformRepository.findByUserIdAndPlatform(1L, "BILIBILI")).thenReturn(Optional.of(credential));
        when(credentialCryptoService.decrypt("encrypted-cookie")).thenReturn("sessdata=abc; bili_jct=def; dedeuserid=123");
        when(jwtUtil.generateToken("testuser", 1L)).thenReturn("crawler-jwt-token");

        // When
        ResponseEntity<Map<String, Object>> response = controller.triggerCrawl(platform);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertEquals("started", body.get("status"));
        assertEquals("bilibili", body.get("platform"));
        assertEquals("testuser", body.get("user"));
        verify(jwtUtil).generateToken("testuser", 1L);
    }

    @Test
    void triggerCrawl_ReturnsStartedForAll() {
        // Given
        setupAuthenticatedUser();
        String platform = "all";
        when(jwtUtil.generateToken("testuser", 1L)).thenReturn("crawler-jwt-token");

        // When
        ResponseEntity<Map<String, Object>> response = controller.triggerCrawl(platform);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertEquals("started", body.get("status"));
        assertEquals("all", body.get("platform"));
    }

    @Test
    void triggerCrawl_ReturnsDisabledForXiaohongshu() {
        // Given
        String platform = "xiaohongshu";

        // When
        ResponseEntity<Map<String, Object>> response = controller.triggerCrawl(platform);

        // Then
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertEquals("disabled", body.get("status"));
        assertTrue(((String) body.get("message")).contains("浏览器扩展"));
    }

    @Test
    void triggerCrawl_ReturnsDisabledForZhihu() {
        // Given
        String platform = "zhihu";

        // When
        ResponseEntity<Map<String, Object>> response = controller.triggerCrawl(platform);

        // Then
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertEquals("disabled", body.get("status"));
        assertEquals("zhihu", body.get("platform"));
    }

    @Test
    void triggerCrawl_ReturnsReauthRequiredForBilibiliWithoutCredential() {
        // Given
        setupAuthenticatedUser();
        String platform = "bilibili";
        when(userPlatformRepository.findByUserIdAndPlatform(1L, "BILIBILI")).thenReturn(Optional.empty());

        // When
        ResponseEntity<Map<String, Object>> response = controller.triggerCrawl(platform);

        // Then
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertEquals("reauth_required", body.get("status"));
        assertEquals("bilibili", body.get("platform"));
        assertTrue(((String) body.get("message")).contains("授权凭证不可用"));
    }

    @Test
    void triggerCrawl_ReturnsReauthRequiredForBilibiliWithInvalidCredential() {
        // Given
        setupAuthenticatedUser();
        String platform = "bilibili";
        UserPlatform credential = new UserPlatform();
        credential.setUserId(1L);
        credential.setPlatform("BILIBILI");
        credential.setCredential("encrypted-invalid-cookie");

        when(userPlatformRepository.findByUserIdAndPlatform(1L, "BILIBILI")).thenReturn(Optional.of(credential));
        when(credentialCryptoService.decrypt("encrypted-invalid-cookie")).thenReturn("invalid-cookie-without-required-fields");

        // When
        ResponseEntity<Map<String, Object>> response = controller.triggerCrawl(platform);

        // Then
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertEquals("reauth_required", body.get("status"));
        verify(jwtUtil, never()).generateToken(anyString(), anyLong());
    }
}
