package com.infodigest.controller;

import com.infodigest.config.BaseIntegrationTest;
import com.infodigest.entity.User;
import com.infodigest.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class UserControllerIntegrationTest extends BaseIntegrationTest {

    @Autowired
    private UserRepository userRepository;

    @Override
    @BeforeEach
    public void setUpBase() throws Exception {
        super.setUpBase();
    }

    @Test
    void getProfile_shouldReturnCurrentUserProfile() throws Exception {
        mockMvc.perform(get("/api/user/profile")
                        .header("Authorization", "Bearer " + testToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(testUserId))
                .andExpect(jsonPath("$.username").value(testUsername))
                .andExpect(jsonPath("$.email").value(testEmail))
                .andExpect(jsonPath("$.selfPortrait").isString())
                .andExpect(jsonPath("$.avatarUrl").isString());
    }

    @Test
    void updateProfile_shouldUpdateSelfPortrait() throws Exception {
        String newPortrait = "我是一名开发者，喜欢学习新技术。";

        mockMvc.perform(put("/api/user/profile")
                        .header("Authorization", "Bearer " + testToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("selfPortrait", newPortrait))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value(testUsername))
                .andExpect(jsonPath("$.message").value("Profile updated successfully"));

        // Verify it was saved
        User updated = userRepository.findById(testUserId).orElseThrow();
        assert updated.getSelfPortrait().equals(newPortrait) : "Self portrait should be updated";
    }

    @Test
    void updateProfile_withEmptyUsername_shouldReturn400() throws Exception {
        mockMvc.perform(put("/api/user/profile")
                        .header("Authorization", "Bearer " + testToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("username", ""))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void updateProfile_withDuplicateEmail_shouldReturnError() throws Exception {
        // Create another user with a different email
        User anotherUser = new User();
        anotherUser.setUsername("otheruser");
        anotherUser.setEmail("other@example.com");
        anotherUser.setPasswordHash(passwordEncoder.encode("password"));
        userRepository.save(anotherUser);

        // Try to update current user's email to the other user's email (which is unique)
        // The current user's email is test@example.com, so we use a different duplicate scenario
        // Create a third user that has the email we'll try to use
        User thirdUser = new User();
        thirdUser.setUsername("thirduser");
        thirdUser.setEmail("duplicate@example.com");
        thirdUser.setPasswordHash(passwordEncoder.encode("password"));
        userRepository.save(thirdUser);

        // Try to update current user's email to the already-taken email
        mockMvc.perform(put("/api/user/profile")
                        .header("Authorization", "Bearer " + testToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("email", "duplicate@example.com"))))
                .andExpect(status().isBadRequest())
                .andExpect(content().string("Email is already taken!"));
    }

    @Test
    void updateProfile_withNewUsername_shouldSucceed() throws Exception {
        String newUsername = "updateduser";

        mockMvc.perform(put("/api/user/profile")
                        .header("Authorization", "Bearer " + testToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("username", newUsername))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value(newUsername))
                .andExpect(jsonPath("$.message").value("Profile updated successfully"));
    }
}
