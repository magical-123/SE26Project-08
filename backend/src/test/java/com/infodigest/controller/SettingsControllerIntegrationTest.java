package com.infodigest.controller;

import com.infodigest.config.BaseIntegrationTest;
import com.infodigest.entity.UserPlatform;
import com.infodigest.repository.UserPlatformRepository;
import com.infodigest.security.CredentialCryptoService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class SettingsControllerIntegrationTest extends BaseIntegrationTest {

    @Autowired
    private UserPlatformRepository userPlatformRepository;

    @Autowired
    private CredentialCryptoService credentialCryptoService;

    @Override
    @BeforeEach
    public void setUpBase() throws Exception {
        super.setUpBase();
    }

    @Test
    void getPlatforms_shouldReturnPlatformStatusList() throws Exception {
        mockMvc.perform(get("/api/settings/platforms")
                        .header("Authorization", "Bearer " + testToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.platforms").isArray())
                .andExpect(jsonPath("$.platforms.length()").value(4));
    }

    @Test
    void addPlatformCredential_shouldSaveCredential() throws Exception {
        String platform = "github";
        String credential = "ghp_testToken123456";

        mockMvc.perform(post("/api/settings/platforms/{platform}/credential", platform)
                        .header("Authorization", "Bearer " + testToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("credential", credential))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("凭证保存成功"));

        // Verify it was saved in the database
        UserPlatform saved = userPlatformRepository.findByUserIdAndPlatform(testUserId, "GITHUB")
                .orElseThrow(() -> new AssertionError("Platform credential should exist"));
        String decrypted = credentialCryptoService.decrypt(saved.getCredential());
        assert decrypted.equals(credential) : "Credential should match after encryption/decryption";
    }

    @Test
    void deletePlatformCredential_shouldRemoveCredential() throws Exception {
        // First add a platform credential
        UserPlatform platform = new UserPlatform();
        platform.setUserId(testUserId);
        platform.setPlatform("GITHUB");
        platform.setCredential(credentialCryptoService.encrypt("ghp_testToken"));
        userPlatformRepository.save(platform);

        // Then delete it
        mockMvc.perform(delete("/api/settings/platforms/{platform}", "github")
                        .header("Authorization", "Bearer " + testToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("已断开")));

        // Verify it's gone
        assert userPlatformRepository.findByUserIdAndPlatform(testUserId, "GITHUB").isEmpty()
                : "Platform credential should be deleted";
    }

    @Test
    void getPlatformDetailedStatus_shouldReturnDetailedInfo() throws Exception {
        // Add a platform credential first
        UserPlatform platform = new UserPlatform();
        platform.setUserId(testUserId);
        platform.setPlatform("GITHUB");
        platform.setCredential(credentialCryptoService.encrypt("ghp_testToken"));
        userPlatformRepository.save(platform);

        mockMvc.perform(get("/api/settings/platform-status")
                        .header("Authorization", "Bearer " + testToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.github").exists())
                .andExpect(jsonPath("$.github.connected").value(true));
    }

    @Test
    void addPlatformCredential_withNullCredential_shouldReturn400() throws Exception {
        mockMvc.perform(post("/api/settings/platforms/{platform}/credential", "github")
                        .header("Authorization", "Bearer " + testToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("credential 不能为 null"));
    }

    @Test
    void addPlatformCredential_forBilibili_savesCredential() throws Exception {
        String credential = "SESSDATA=test123; bili_jct=abc456; DedeUserID=789";

        mockMvc.perform(post("/api/settings/platforms/{platform}/credential", "bilibili")
                        .header("Authorization", "Bearer " + testToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("credential", credential))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("凭证保存成功"))
                .andExpect(jsonPath("$.platform").value("bilibili"));

        // Verify in database
        UserPlatform saved = userPlatformRepository.findByUserIdAndPlatform(testUserId, "BILIBILI")
                .orElseThrow(() -> new AssertionError("Bilibili credential should exist"));
        String decrypted = credentialCryptoService.decrypt(saved.getCredential());
        assert decrypted.equals(credential) : "Bilibili credential should match after encryption";
    }

    @Test
    void deletePlatformCredential_forBilibili_removesPlatform() throws Exception {
        // First add a Bilibili credential
        UserPlatform platform = new UserPlatform();
        platform.setUserId(testUserId);
        platform.setPlatform("BILIBILI");
        platform.setCredential(credentialCryptoService.encrypt("SESSDATA=test; bili_jct=test; DedeUserID=1"));
        userPlatformRepository.save(platform);

        // Then delete it
        mockMvc.perform(delete("/api/settings/platforms/{platform}", "bilibili")
                        .header("Authorization", "Bearer " + testToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("已断开")));

        // Verify it's gone
        assert userPlatformRepository.findByUserIdAndPlatform(testUserId, "BILIBILI").isEmpty()
                : "Bilibili credential should be deleted";
    }

    @Test
    void markCredentialInvalid_forBilibili_marksAsExpired() throws Exception {
        // First add a Bilibili credential
        UserPlatform platform = new UserPlatform();
        platform.setUserId(testUserId);
        platform.setPlatform("BILIBILI");
        platform.setCredential(credentialCryptoService.encrypt("SESSDATA=test; bili_jct=test; DedeUserID=1"));
        userPlatformRepository.save(platform);

        mockMvc.perform(post("/api/settings/platforms/{platform}/credential-invalid", "bilibili")
                        .header("Authorization", "Bearer " + testToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("reason", "Cookie expired"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.status").value("credential_expired"));

        // Verify credential is marked expired
        UserPlatform updated = userPlatformRepository.findByUserIdAndPlatform(testUserId, "BILIBILI")
                .orElseThrow(() -> new AssertionError("Bilibili platform record should still exist"));
        String decrypted = credentialCryptoService.decrypt(updated.getCredential());
        assert decrypted.startsWith("__INFODIGEST_CREDENTIAL_EXPIRED__") : "Credential should be marked as expired";
    }

    @Test
    void getCredentials_returnsEncryptedCredentials() throws Exception {
        // Add credentials for multiple platforms
        UserPlatform bili = new UserPlatform();
        bili.setUserId(testUserId);
        bili.setPlatform("BILIBILI");
        bili.setCredential(credentialCryptoService.encrypt("SESSDATA=valid; bili_jct=valid; DedeUserID=1"));
        userPlatformRepository.save(bili);

        UserPlatform github = new UserPlatform();
        github.setUserId(testUserId);
        github.setPlatform("GITHUB");
        github.setCredential(credentialCryptoService.encrypt("ghp_testToken"));
        userPlatformRepository.save(github);

        mockMvc.perform(get("/api/settings/credentials")
                        .header("Authorization", "Bearer " + testToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bilibili").exists())
                .andExpect(jsonPath("$.bilibili.credential").isString())
                .andExpect(jsonPath("$.github").exists())
                .andExpect(jsonPath("$.github.credential").isString());
    }

    @Test
    void deletePlatformCredentialOnly_clearsCredentialOnly() throws Exception {
        // First add a credential
        UserPlatform platform = new UserPlatform();
        platform.setUserId(testUserId);
        platform.setPlatform("ZHIHU");
        platform.setCredential(credentialCryptoService.encrypt("zhihu_cookie_test"));
        userPlatformRepository.save(platform);

        mockMvc.perform(delete("/api/settings/platforms/{platform}/credential-only", "zhihu")
                        .header("Authorization", "Bearer " + testToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("已清除")));

        // Verify credential is removed
        assert userPlatformRepository.findByUserIdAndPlatform(testUserId, "ZHIHU").isEmpty()
                : "Zhihu credential should be deleted";
    }

    @Test
    void getPlatformDetailedStatus_withNoData_returnsEmpty() throws Exception {
        mockMvc.perform(get("/api/settings/platform-status")
                        .header("Authorization", "Bearer " + testToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isMap())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void getPlatforms_withBilibiliConnected_showsConnected() throws Exception {
        // Add a bilibili credential
        UserPlatform platform = new UserPlatform();
        platform.setUserId(testUserId);
        platform.setPlatform("BILIBILI");
        platform.setCredential(credentialCryptoService.encrypt("SESSDATA=valid; bili_jct=valid; DedeUserID=1"));
        userPlatformRepository.save(platform);

        mockMvc.perform(get("/api/settings/platforms")
                        .header("Authorization", "Bearer " + testToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.platforms").isArray())
                .andExpect(jsonPath("$.platforms.length()").value(4))
                .andExpect(jsonPath("$.platforms[0].key").value("bilibili"))
                .andExpect(jsonPath("$.platforms[0].connected").value(true));
    }
}
