package com.infodigest.controller;

import com.infodigest.entity.InformationItem;
import com.infodigest.entity.User;
import com.infodigest.repository.InformationItemRepository;
import com.infodigest.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.redisson.api.RBlockingDeque;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class InboxControllerEngagementTest {
    private InformationItemRepository items;
    private RBlockingDeque<Long> queue;
    private InboxController controller;

    @BeforeEach
    void setUp() {
        items = mock(InformationItemRepository.class);
        UserRepository users = mock(UserRepository.class);
        queue = mock(RBlockingDeque.class);
        controller = new InboxController();
        ReflectionTestUtils.setField(controller, "informationItemRepository", items);
        ReflectionTestUtils.setField(controller, "userRepository", users);
        ReflectionTestUtils.setField(controller, "analysisQueue", queue);
        User user = new User(); user.setId(1L); user.setUsername("alice");
        when(users.findByUsername("alice")).thenReturn(Optional.of(user));
        SecurityContextHolder.getContext().setAuthentication(
                UsernamePasswordAuthenticationToken.authenticated("alice", null, java.util.List.of()));
    }

    @AfterEach
    void tearDown() { SecurityContextHolder.clearContext(); }

    @Test
    void enrichesExistingTitleOnlyItemAndQueuesReanalysis() {
        InformationItem existing = new InformationItem();
        existing.setId(9L); existing.setUserId(1L); existing.setUrl("https://www.xiaohongshu.com/explore/abc");
        existing.setPlatform("XIAOHONGSHU"); existing.setTitle("旅行笔记"); existing.setContentRaw("旅行笔记");
        existing.setProcessStatus("PROCESSED"); existing.setWatchDurationSeconds(5);
        when(items.findTopByUserIdAndUrlAndPlatformOrderByCrawledAtDesc(1L, existing.getUrl(), "XIAOHONGSHU"))
                .thenReturn(Optional.of(existing));
        when(items.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        String fullText = "这是从小红书详情页提取的完整正文，包含旅行路线、交通方式、住宿体验和具体建议。".repeat(4);
        var response = controller.recordEngagement(Map.of(
                "url", existing.getUrl(), "platform", "XIAOHONGSHU", "title", "旅行笔记",
                "contentRaw", fullText, "deltaSeconds", 5));
        assertEquals(200, response.getStatusCode().value());
        assertEquals(fullText, existing.getContentRaw());
        assertEquals("UNPROCESSED", existing.getProcessStatus());
        assertEquals(Boolean.TRUE, response.getBody().get("contentUpdated"));
        verify(queue).offerAsync(9L);
    }

    @Test
    void ordinaryHeartbeatDoesNotQueueDuplicateAnalysis() {
        InformationItem existing = new InformationItem();
        existing.setId(10L); existing.setUserId(1L); existing.setUrl("https://www.zhihu.com/question/1/answer/2");
        existing.setPlatform("ZHIHU"); existing.setTitle("问题"); existing.setContentRaw("已经保存的完整回答正文".repeat(20));
        existing.setProcessStatus("PROCESSED");
        when(items.findTopByUserIdAndUrlAndPlatformOrderByCrawledAtDesc(1L, existing.getUrl(), "ZHIHU"))
                .thenReturn(Optional.of(existing));
        when(items.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        var response = controller.recordEngagement(Map.of(
                "url", existing.getUrl(), "platform", "ZHIHU", "title", "问题",
                "contentRaw", existing.getContentRaw(), "deltaSeconds", 5));
        assertEquals(Boolean.FALSE, response.getBody().get("contentUpdated"));
        verify(queue, never()).offerAsync(anyLong());
    }
}
