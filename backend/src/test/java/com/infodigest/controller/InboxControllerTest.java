package com.infodigest.controller;

import com.infodigest.entity.InformationItem;
import com.infodigest.entity.User;
import com.infodigest.repository.InformationItemRepository;
import com.infodigest.repository.ItemConceptRepository;
import com.infodigest.repository.UserRepository;
import com.infodigest.service.AiSummaryService;
import com.infodigest.service.KeywordService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.redisson.api.RBlockingDeque;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class InboxControllerTest {

    private InformationItemRepository informationItemRepository;
    private UserRepository userRepository;
    private ItemConceptRepository itemConceptRepository;
    private AiSummaryService aiSummaryService;
    private KeywordService keywordService;
    @SuppressWarnings("unchecked")
    private RBlockingDeque<Long> analysisQueue;
    private InboxController controller;
    private final User currentUser = new User();

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        informationItemRepository = mock(InformationItemRepository.class);
        userRepository = mock(UserRepository.class);
        itemConceptRepository = mock(ItemConceptRepository.class);
        aiSummaryService = mock(AiSummaryService.class);
        keywordService = mock(KeywordService.class);
        analysisQueue = mock(RBlockingDeque.class);

        controller = new InboxController();
        ReflectionTestUtils.setField(controller, "informationItemRepository", informationItemRepository);
        ReflectionTestUtils.setField(controller, "userRepository", userRepository);
        ReflectionTestUtils.setField(controller, "itemConceptRepository", itemConceptRepository);
        ReflectionTestUtils.setField(controller, "aiSummaryService", aiSummaryService);
        ReflectionTestUtils.setField(controller, "keywordService", keywordService);
        ReflectionTestUtils.setField(controller, "analysisQueue", analysisQueue);

        currentUser.setId(1L);
        currentUser.setUsername("testuser");
        when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(currentUser));
        when(userRepository.findById(1L)).thenReturn(Optional.of(currentUser));
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("testuser", null, java.util.List.of()));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @SuppressWarnings("unchecked")
    @Test
    void getItems_ReturnsPaginatedItems() {
        // Given
        InformationItem item1 = new InformationItem();
        item1.setId(1L);
        item1.setUserId(1L);
        item1.setTitle("Test Item 1");
        item1.setPlatform("BILIBILI");
        item1.setCrawledAt(LocalDateTime.now());

        InformationItem item2 = new InformationItem();
        item2.setId(2L);
        item2.setUserId(1L);
        item2.setTitle("Test Item 2");
        item2.setPlatform("ZHIHU");
        item2.setCrawledAt(LocalDateTime.now());

        Page<InformationItem> page = new PageImpl<>(List.of(item1, item2));
        when(informationItemRepository.findByUserId(eq(1L), any(PageRequest.class))).thenReturn(page);
        when(informationItemRepository.countByUserIdAndIsPremiumTrue(1L)).thenReturn(1L);
        when(informationItemRepository.countByUserIdAndAiSummaryIsNotNull(1L)).thenReturn(1L);

        // When
        ResponseEntity<Map<String, Object>> response = controller.getInboxItems(0, 100, 1000, null, null);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertEquals(2L, body.get("totalItems"));
        assertNotNull(body.get("items"));
    }

    @SuppressWarnings("unchecked")
    @Test
    void getItems_FiltersByPlatform() {
        // Given
        InformationItem item1 = new InformationItem();
        item1.setId(1L);
        item1.setUserId(1L);
        item1.setTitle("B站视频");
        item1.setPlatform("BILIBILI");
        item1.setCrawledAt(LocalDateTime.now());

        InformationItem item2 = new InformationItem();
        item2.setId(2L);
        item2.setUserId(1L);
        item2.setTitle("知乎文章");
        item2.setPlatform("ZHIHU");
        item2.setCrawledAt(LocalDateTime.now());

        Page<InformationItem> page = new PageImpl<>(List.of(item1, item2));
        when(informationItemRepository.findByUserId(eq(1L), any(PageRequest.class))).thenReturn(page);
        when(informationItemRepository.countByUserIdAndIsPremiumTrue(1L)).thenReturn(0L);
        when(informationItemRepository.countByUserIdAndAiSummaryIsNotNull(1L)).thenReturn(0L);

        // When
        ResponseEntity<Map<String, Object>> response = controller.getInboxItems(0, 100, 1000, "BILIBILI", null);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        List<InformationItem> items = (List<InformationItem>) body.get("items");
        assertEquals(1, items.size());
        assertEquals("BILIBILI", items.get(0).getPlatform());
    }

    @SuppressWarnings("unchecked")
    @Test
    void getItems_HandlesEmptyResults() {
        // Given
        Page<InformationItem> emptyPage = new PageImpl<>(List.of());
        when(informationItemRepository.findByUserId(eq(1L), any(PageRequest.class))).thenReturn(emptyPage);
        when(informationItemRepository.countByUserIdAndIsPremiumTrue(1L)).thenReturn(0L);
        when(informationItemRepository.countByUserIdAndAiSummaryIsNotNull(1L)).thenReturn(0L);

        // When
        ResponseEntity<Map<String, Object>> response = controller.getInboxItems(0, 100, 1000, null, null);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertEquals(0L, body.get("totalItems"));
        List<InformationItem> items = (List<InformationItem>) body.get("items");
        assertTrue(items.isEmpty());
    }

    @Test
    void getInboxItem_ReturnsItem() {
        // Given
        InformationItem item = new InformationItem();
        item.setId(1L);
        item.setUserId(1L);
        item.setTitle("Test Item");
        item.setPlatform("BILIBILI");

        when(informationItemRepository.findByIdAndUserId(1L, 1L)).thenReturn(Optional.of(item));

        // When
        ResponseEntity<InformationItem> response = controller.getInboxItem(1L);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals("Test Item", response.getBody().getTitle());
    }

    @Test
    void getInboxItem_ReturnsNotFound() {
        // Given
        when(informationItemRepository.findByIdAndUserId(99L, 1L)).thenReturn(Optional.empty());

        // When
        ResponseEntity<InformationItem> response = controller.getInboxItem(99L);

        // Then
        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
    }

    @Test
    void createInboxItem_CreatesNewItem() {
        // Given
        InformationItem item = new InformationItem();
        item.setTitle("New Test Item");
        item.setPlatform("BILIBILI");

        InformationItem savedItem = new InformationItem();
        savedItem.setId(1L);
        savedItem.setUserId(1L);
        savedItem.setTitle("New Test Item");
        savedItem.setPlatform("BILIBILI");

        when(informationItemRepository.findTopByUserIdAndTitleAndPlatformOrderByCrawledAtDesc(
                eq(1L), eq("New Test Item"), eq("BILIBILI"))).thenReturn(Optional.empty());
        when(informationItemRepository.save(any(InformationItem.class))).thenReturn(savedItem);
        when(analysisQueue.offerAsync(anyLong())).thenReturn(mock(org.redisson.api.RFuture.class));

        // When
        ResponseEntity<InformationItem> response = controller.createInboxItem(item);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals("New Test Item", response.getBody().getTitle());
        verify(informationItemRepository, times(1)).save(any(InformationItem.class));
        verify(analysisQueue, times(1)).offerAsync(1L);
    }

    @Test
    void createInboxItem_ReturnsBadRequest_WhenInvalid() {
        // Given - metadata title (starts with "发布于")
        InformationItem item = new InformationItem();
        item.setTitle("发布于 2024-01-01");
        item.setPlatform("BILIBILI");

        // When
        ResponseEntity<InformationItem> response = controller.createInboxItem(item);

        // Then
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        verify(informationItemRepository, never()).save(any(InformationItem.class));
    }

    @Test
    void createInboxItem_SkipsDuplicate() {
        // Given
        InformationItem item = new InformationItem();
        item.setTitle("Duplicate Item");
        item.setPlatform("BILIBILI");
        item.setUrl("https://example.com");

        InformationItem existingItem = new InformationItem();
        existingItem.setId(1L);
        existingItem.setUserId(1L);
        existingItem.setTitle("Duplicate Item");
        existingItem.setPlatform("BILIBILI");

        when(informationItemRepository.findTopByUserIdAndTitleAndPlatformOrderByCrawledAtDesc(
                eq(1L), eq("Duplicate Item"), eq("BILIBILI"))).thenReturn(Optional.of(existingItem));

        // When
        ResponseEntity<InformationItem> response = controller.createInboxItem(item);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals(existingItem.getId(), response.getBody().getId());
        verify(informationItemRepository, never()).save(any(InformationItem.class));
        verify(analysisQueue, never()).offerAsync(anyLong());
    }

    @Test
    void deleteInboxItem_DeletesItem() {
        // Given
        InformationItem item = new InformationItem();
        item.setId(1L);
        item.setUserId(1L);
        item.setTitle("To Delete");

        when(informationItemRepository.findByIdAndUserId(1L, 1L)).thenReturn(Optional.of(item));

        // When
        ResponseEntity<Void> response = controller.deleteInboxItem(1L);

        // Then
        assertEquals(HttpStatus.NO_CONTENT, response.getStatusCode());
        verify(itemConceptRepository, times(1)).deleteByItemId(1L);
        verify(informationItemRepository, times(1)).deleteById(1L);
    }

    @Test
    void deleteInboxItem_ReturnsNotFound() {
        // Given
        when(informationItemRepository.findByIdAndUserId(99L, 1L)).thenReturn(Optional.empty());

        // When
        ResponseEntity<Void> response = controller.deleteInboxItem(99L);

        // Then
        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
        verify(itemConceptRepository, never()).deleteByItemId(anyLong());
        verify(informationItemRepository, never()).deleteById(anyLong());
    }

    @Test
    void toggleLike_TogglesLike() {
        // Given
        InformationItem item = new InformationItem();
        item.setId(1L);
        item.setUserId(1L);
        item.setIsLiked(false);

        when(informationItemRepository.findByIdAndUserId(1L, 1L)).thenReturn(Optional.of(item));

        // When
        ResponseEntity<Map<String, Object>> response = controller.toggleLike(1L);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertEquals(true, body.get("isLiked"));
        verify(informationItemRepository, times(1)).updateIsLiked(1L, true);
    }

    @Test
    void toggleFavorite_TogglesFavorite() {
        // Given
        InformationItem item = new InformationItem();
        item.setId(1L);
        item.setUserId(1L);
        item.setIsFavorite(false);

        when(informationItemRepository.findByIdAndUserId(1L, 1L)).thenReturn(Optional.of(item));

        // When
        ResponseEntity<Map<String, Object>> response = controller.toggleFavorite(1L);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertEquals(true, body.get("isFavorite"));
        verify(informationItemRepository, times(1)).updateIsFavorite(1L, true);
    }

    @Test
    void updateInboxItem_UpdatesFields() {
        // Given
        InformationItem existingItem = new InformationItem();
        existingItem.setId(1L);
        existingItem.setUserId(1L);
        existingItem.setTitle("Original Title");
        existingItem.setPlatform("BILIBILI");

        InformationItem updatedItem = new InformationItem();
        updatedItem.setId(1L);
        updatedItem.setUserId(1L);
        updatedItem.setTitle("Updated Title");
        updatedItem.setPlatform("BILIBILI");

        Map<String, Object> updates = Map.of("title", "Updated Title");

        when(informationItemRepository.findByIdAndUserId(1L, 1L)).thenReturn(Optional.of(existingItem));
        when(informationItemRepository.save(any(InformationItem.class))).thenReturn(updatedItem);

        // When
        ResponseEntity<InformationItem> response = controller.updateInboxItem(1L, updates);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals("Updated Title", response.getBody().getTitle());
        verify(informationItemRepository, times(1)).save(any(InformationItem.class));
    }

    @Test
    void updateInboxItem_ReturnsNotFound() {
        // Given
        Map<String, Object> updates = Map.of("title", "New Title");

        when(informationItemRepository.findByIdAndUserId(99L, 1L)).thenReturn(Optional.empty());

        // When
        ResponseEntity<InformationItem> response = controller.updateInboxItem(99L, updates);

        // Then
        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
        verify(informationItemRepository, never()).save(any(InformationItem.class));
    }

    @Test
    @SuppressWarnings("unchecked")
    void createInboxItemsBatch_CreatesBatchItems() {
        // Given
        InformationItem item1 = new InformationItem();
        item1.setTitle("Test Item 1");
        item1.setPlatform("BILIBILI");
        item1.setUrl("https://bilibili.com/video/1");

        InformationItem item2 = new InformationItem();
        item2.setTitle("Test Item 2");
        item2.setPlatform("GITHUB");
        item2.setUrl("https://github.com/repo");

        InformationItem saved1 = new InformationItem();
        saved1.setId(1L);
        saved1.setUserId(1L);
        saved1.setTitle("Test Item 1");
        saved1.setPlatform("BILIBILI");

        InformationItem saved2 = new InformationItem();
        saved2.setId(2L);
        saved2.setUserId(1L);
        saved2.setTitle("Test Item 2");
        saved2.setPlatform("GITHUB");

        lenient().when(informationItemRepository.findTopByUserIdAndTitleAndPlatformOrderByCrawledAtDesc(
                any(), any(), any())).thenReturn(Optional.empty());
        lenient().when(informationItemRepository.findTopByUserIdAndUrlAndPlatformOrderByCrawledAtDesc(
                any(), any(), any())).thenReturn(Optional.empty());
        when(informationItemRepository.save(any(InformationItem.class))).thenReturn(saved1, saved2);
        when(analysisQueue.offerAsync(anyLong())).thenReturn(mock(org.redisson.api.RFuture.class));

        // When
        ResponseEntity<Map<String, Object>> response = controller.createInboxItemsBatch(List.of(item1, item2));

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertEquals(true, body.get("success"));
        assertEquals(2, body.get("count"));
        assertEquals(0, body.get("skipped"));
        assertEquals(0, body.get("failed"));
        verify(informationItemRepository, times(2)).save(any(InformationItem.class));
    }

    @Test
    @SuppressWarnings("unchecked")
    void createInboxItemsBatch_SkipsXiaohongshuAndZhihu() {
        // Given
        InformationItem bilibiliItem = new InformationItem();
        bilibiliItem.setTitle("B站视频");
        bilibiliItem.setPlatform("BILIBILI");
        bilibiliItem.setUrl("https://bilibili.com/video/1");

        InformationItem xiaohongshuItem = new InformationItem();
        xiaohongshuItem.setTitle("小红书笔记");
        xiaohongshuItem.setPlatform("XIAOHONGSHU");

        InformationItem zhihuItem = new InformationItem();
        zhihuItem.setTitle("知乎文章");
        zhihuItem.setPlatform("ZHIHU");

        InformationItem saved1 = new InformationItem();
        saved1.setId(1L);
        saved1.setUserId(1L);
        saved1.setTitle("B站视频");
        saved1.setPlatform("BILIBILI");

        lenient().when(informationItemRepository.findTopByUserIdAndTitleAndPlatformOrderByCrawledAtDesc(
                any(), any(), any())).thenReturn(Optional.empty());
        lenient().when(informationItemRepository.findTopByUserIdAndUrlAndPlatformOrderByCrawledAtDesc(
                any(), any(), any())).thenReturn(Optional.empty());
        when(informationItemRepository.save(any(InformationItem.class))).thenReturn(saved1);
        when(analysisQueue.offerAsync(anyLong())).thenReturn(mock(org.redisson.api.RFuture.class));

        // When
        ResponseEntity<Map<String, Object>> response = controller.createInboxItemsBatch(
                List.of(bilibiliItem, xiaohongshuItem, zhihuItem));

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertEquals(1, body.get("count"));
        assertEquals(2, body.get("skipped"));
        assertEquals(0, body.get("failed"));
        verify(informationItemRepository, times(1)).save(any(InformationItem.class));
    }

    @Test
    @SuppressWarnings("unchecked")
    void createInboxItemsBatch_SkipsMetadataTitle() {
        // Given
        InformationItem validItem = new InformationItem();
        validItem.setTitle("Regular Title");
        validItem.setPlatform("BILIBILI");
        validItem.setUrl("https://bilibili.com/video/1");

        InformationItem metadataItem = new InformationItem();
        metadataItem.setTitle("发布于 2024-01-01");
        metadataItem.setPlatform("BILIBILI");

        InformationItem saved1 = new InformationItem();
        saved1.setId(1L);
        saved1.setUserId(1L);
        saved1.setTitle("Regular Title");
        saved1.setPlatform("BILIBILI");

        lenient().when(informationItemRepository.findTopByUserIdAndTitleAndPlatformOrderByCrawledAtDesc(
                any(), any(), any())).thenReturn(Optional.empty());
        lenient().when(informationItemRepository.findTopByUserIdAndUrlAndPlatformOrderByCrawledAtDesc(
                any(), any(), any())).thenReturn(Optional.empty());
        when(informationItemRepository.save(any(InformationItem.class))).thenReturn(saved1);
        when(analysisQueue.offerAsync(anyLong())).thenReturn(mock(org.redisson.api.RFuture.class));

        // When
        ResponseEntity<Map<String, Object>> response = controller.createInboxItemsBatch(
                List.of(validItem, metadataItem));

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertEquals(1, body.get("count"));
        assertEquals(1, body.get("skipped"));
        assertEquals(0, body.get("failed"));
        verify(informationItemRepository, times(1)).save(any(InformationItem.class));
    }

    @Test
    @SuppressWarnings("unchecked")
    void recordEngagement_CreatesNewItem() {
        // Given
        Map<String, Object> payload = new java.util.HashMap<>();
        payload.put("url", "https://example.com/article");
        payload.put("platform", "BILIBILI");
        payload.put("title", "Test Engagement Title");
        payload.put("deltaSeconds", 30);
        payload.put("author", "TestAuthor");

        InformationItem savedItem = new InformationItem();
        savedItem.setId(1L);
        savedItem.setUserId(1L);
        savedItem.setUrl("https://example.com/article");
        savedItem.setPlatform("BILIBILI");
        savedItem.setTitle("Test Engagement Title");
        savedItem.setWatchDurationSeconds(30);

        when(informationItemRepository.findTopByUserIdAndUrlAndPlatformOrderByCrawledAtDesc(
                eq(1L), eq("https://example.com/article"), eq("BILIBILI"))).thenReturn(Optional.empty());
        when(informationItemRepository.save(any(InformationItem.class))).thenReturn(savedItem);
        when(analysisQueue.offerAsync(anyLong())).thenReturn(mock(org.redisson.api.RFuture.class));

        // When
        ResponseEntity<Map<String, Object>> response = controller.recordEngagement(payload);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertEquals(true, body.get("success"));
        assertEquals(true, body.get("created"));
        verify(informationItemRepository, times(1)).save(any(InformationItem.class));
        verify(analysisQueue, times(1)).offerAsync(1L);
    }

    @Test
    @SuppressWarnings("unchecked")
    void recordEngagement_UpdatesExistingAndDuration() {
        // Given
        InformationItem existingItem = new InformationItem();
        existingItem.setId(1L);
        existingItem.setUserId(1L);
        existingItem.setUrl("https://example.com/article");
        existingItem.setPlatform("BILIBILI");
        existingItem.setTitle("Existing Title");
        existingItem.setWatchDurationSeconds(100);

        Map<String, Object> payload = new java.util.HashMap<>();
        payload.put("url", "https://example.com/article");
        payload.put("platform", "BILIBILI");
        payload.put("title", "Existing Title");
        payload.put("deltaSeconds", 30);
        payload.put("contentDurationSeconds", 300);

        InformationItem updatedItem = new InformationItem();
        updatedItem.setId(1L);
        updatedItem.setUserId(1L);
        updatedItem.setUrl("https://example.com/article");
        updatedItem.setPlatform("BILIBILI");
        updatedItem.setTitle("Existing Title");
        updatedItem.setWatchDurationSeconds(130);
        updatedItem.setDurationMinutes(5);
        updatedItem.setCompletionRate(130.0 / 300.0);

        when(informationItemRepository.findTopByUserIdAndUrlAndPlatformOrderByCrawledAtDesc(
                eq(1L), eq("https://example.com/article"), eq("BILIBILI"))).thenReturn(Optional.of(existingItem));
        when(informationItemRepository.save(any(InformationItem.class))).thenReturn(updatedItem);

        // When
        ResponseEntity<Map<String, Object>> response = controller.recordEngagement(payload);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertEquals(true, body.get("success"));
        assertEquals(false, body.get("created"));
        assertEquals(130, body.get("watchDurationSeconds"));
        verify(informationItemRepository, times(1)).save(any(InformationItem.class));
    }

    @Test
    void recordEngagement_ReturnsBadRequest_WhenMissingFields() {
        // Given - missing url
        Map<String, Object> payload1 = new java.util.HashMap<>();
        payload1.put("platform", "BILIBILI");
        payload1.put("title", "Test");
        payload1.put("deltaSeconds", 30);

        // When
        ResponseEntity<Map<String, Object>> response1 = controller.recordEngagement(payload1);

        // Then
        assertEquals(HttpStatus.BAD_REQUEST, response1.getStatusCode());

        // Given - missing platform
        Map<String, Object> payload2 = new java.util.HashMap<>();
        payload2.put("url", "https://example.com");
        payload2.put("title", "Test");
        payload2.put("deltaSeconds", 30);

        // When
        ResponseEntity<Map<String, Object>> response2 = controller.recordEngagement(payload2);

        // Then
        assertEquals(HttpStatus.BAD_REQUEST, response2.getStatusCode());

        // Given - metadata title
        Map<String, Object> payload3 = new java.util.HashMap<>();
        payload3.put("url", "https://example.com");
        payload3.put("platform", "BILIBILI");
        payload3.put("title", "发布于 2024-01-01");
        payload3.put("deltaSeconds", 30);

        // When
        ResponseEntity<Map<String, Object>> response3 = controller.recordEngagement(payload3);

        // Then
        assertEquals(HttpStatus.BAD_REQUEST, response3.getStatusCode());

        // Given - deltaSeconds out of range
        Map<String, Object> payload4 = new java.util.HashMap<>();
        payload4.put("url", "https://example.com");
        payload4.put("platform", "BILIBILI");
        payload4.put("title", "Test Title");
        payload4.put("deltaSeconds", 999);

        // When
        ResponseEntity<Map<String, Object>> response4 = controller.recordEngagement(payload4);

        // Then
        assertEquals(HttpStatus.BAD_REQUEST, response4.getStatusCode());
    }

    @Test
    void cleanupMetadataTitleItems_RemovesInvalidItems() {
        // Given
        InformationItem validItem = new InformationItem();
        validItem.setId(1L);
        validItem.setUserId(1L);
        validItem.setTitle("Regular Title");
        validItem.setPlatform("BILIBILI");

        InformationItem metadataItem = new InformationItem();
        metadataItem.setId(2L);
        metadataItem.setUserId(1L);
        metadataItem.setTitle("发布于 2024-01-01");
        metadataItem.setPlatform("BILIBILI");

        when(informationItemRepository.findByUserId(1L)).thenReturn(List.of(validItem, metadataItem));

        // When
        ResponseEntity<Map<String, Object>> response = controller.cleanupMetadataTitleItems();

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertEquals(1, body.get("deleted"));
        verify(itemConceptRepository, times(1)).deleteByItemId(2L);
        verify(informationItemRepository, times(1)).deleteAll(anyList());
    }

    @Test
    @SuppressWarnings("unchecked")
    void regenerateSummary_ResetsFailedStatus() {
        // Given
        InformationItem item = new InformationItem();
        item.setId(1L);
        item.setUserId(1L);
        item.setTitle("Test Item");
        item.setProcessStatus("FAILED");

        when(informationItemRepository.findByIdAndUserId(1L, 1L)).thenReturn(Optional.of(item));
        when(analysisQueue.offerAsync(anyLong())).thenReturn(mock(org.redisson.api.RFuture.class));

        // When
        ResponseEntity<Map<String, Object>> response = controller.regenerateSummary(1L);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertEquals(true, body.get("success"));
        verify(informationItemRepository, times(1)).updateProcessStatus(1L, "UNPROCESSED");
        verify(analysisQueue, times(1)).offerAsync(1L);
    }

    @Test
    @SuppressWarnings("unchecked")
    void regenerateSummary_DoesNotResetNonFailed() {
        // Given
        InformationItem item = new InformationItem();
        item.setId(2L);
        item.setUserId(1L);
        item.setTitle("Test Item");
        item.setProcessStatus("UNPROCESSED");

        when(informationItemRepository.findByIdAndUserId(2L, 1L)).thenReturn(Optional.of(item));
        when(analysisQueue.offerAsync(anyLong())).thenReturn(mock(org.redisson.api.RFuture.class));

        // When
        ResponseEntity<Map<String, Object>> response = controller.regenerateSummary(2L);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertEquals(true, body.get("success"));
        verify(informationItemRepository, never()).updateProcessStatus(anyLong(), anyString());
        verify(analysisQueue, times(1)).offerAsync(2L);
    }

    @Test
    @SuppressWarnings("unchecked")
    void fixMissingSummaries_TriggersGeneration() {
        // Given
        InformationItem item1 = new InformationItem();
        item1.setId(1L);
        item1.setUserId(1L);
        item1.setTitle("Test Item 1");
        item1.setProcessStatus("UNPROCESSED");
        item1.setAiSummary(null);

        InformationItem item2 = new InformationItem();
        item2.setId(2L);
        item2.setUserId(1L);
        item2.setTitle("Test Item 2");
        item2.setProcessStatus("FAILED");
        item2.setAiSummary(null);

        InformationItem item3 = new InformationItem();
        item3.setId(3L);
        item3.setUserId(1L);
        item3.setTitle("Test Item 3");
        item3.setProcessStatus("PROCESSED");
        item3.setAiSummary("Existing summary");

        when(informationItemRepository.findByUserId(1L)).thenReturn(List.of(item1, item2, item3));
        when(analysisQueue.offerAsync(anyLong())).thenReturn(mock(org.redisson.api.RFuture.class));

        // When
        ResponseEntity<Map<String, Object>> response = controller.fixMissingSummaries();

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertEquals(2, body.get("missingCount"));
        assertEquals(2, body.get("triggered"));
        assertEquals(1, body.get("resetFailed"));
        verify(informationItemRepository, times(1)).updateProcessStatus(2L, "UNPROCESSED");
        verify(analysisQueue, times(1)).offerAsync(1L);
        verify(analysisQueue, times(1)).offerAsync(2L);
    }

    @Test
    @SuppressWarnings("unchecked")
    void getInboxItems_WithPremiumFilter() {
        // Given
        InformationItem premiumItem = new InformationItem();
        premiumItem.setId(1L);
        premiumItem.setUserId(1L);
        premiumItem.setTitle("Premium Item");
        premiumItem.setPlatform("BILIBILI");
        premiumItem.setIsPremium(true);
        premiumItem.setCrawledAt(LocalDateTime.now());

        InformationItem regularItem = new InformationItem();
        regularItem.setId(2L);
        regularItem.setUserId(1L);
        regularItem.setTitle("Regular Item");
        regularItem.setPlatform("ZHIHU");
        regularItem.setIsPremium(false);
        regularItem.setCrawledAt(LocalDateTime.now());

        Page<InformationItem> page = new PageImpl<>(List.of(premiumItem, regularItem));
        when(informationItemRepository.findByUserId(eq(1L), any(PageRequest.class))).thenReturn(page);
        when(informationItemRepository.countByUserIdAndIsPremiumTrue(1L)).thenReturn(1L);
        when(informationItemRepository.countByUserIdAndAiSummaryIsNotNull(1L)).thenReturn(0L);

        // When
        ResponseEntity<Map<String, Object>> response = controller.getInboxItems(0, 100, 1000, null, true);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        List<InformationItem> items = (List<InformationItem>) body.get("items");
        assertEquals(1, items.size());
        assertEquals(true, items.get(0).getIsPremium());
        assertEquals(1L, body.get("totalItems"));
    }

    @Test
    void createInboxItem_WithUrlDedupFallback() {
        // Given
        InformationItem item = new InformationItem();
        item.setTitle("Item Title");
        item.setPlatform("BILIBILI");
        item.setUrl("https://example.com/video");

        InformationItem existingItem = new InformationItem();
        existingItem.setId(1L);
        existingItem.setUserId(1L);
        existingItem.setTitle("Different Title");
        existingItem.setPlatform("BILIBILI");
        existingItem.setUrl("https://example.com/video");

        // Title+platform lookup returns empty (title doesn't match existing)
        when(informationItemRepository.findTopByUserIdAndTitleAndPlatformOrderByCrawledAtDesc(
                eq(1L), eq("Item Title"), eq("BILIBILI"))).thenReturn(Optional.empty());
        // URL+platform lookup finds existing
        when(informationItemRepository.findTopByUserIdAndUrlAndPlatformOrderByCrawledAtDesc(
                eq(1L), eq("https://example.com/video"), eq("BILIBILI"))).thenReturn(Optional.of(existingItem));

        // When
        ResponseEntity<InformationItem> response = controller.createInboxItem(item);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals(1L, response.getBody().getId());
        assertEquals("Different Title", response.getBody().getTitle());
        verify(informationItemRepository, never()).save(any(InformationItem.class));
        verify(analysisQueue, never()).offerAsync(anyLong());
    }

    // ========== P0 - createInboxItemsBatch 重复数据合并分支 ==========

    @Test
    @SuppressWarnings("unchecked")
    void createInboxItemsBatch_重复数据合并_更新作者和isPremium() {
        // Given
        InformationItem existingItem = new InformationItem();
        existingItem.setId(1L);
        existingItem.setUserId(1L);
        existingItem.setTitle("Dup Item");
        existingItem.setPlatform("BILIBILI");
        existingItem.setAuthor("ALongExistingAuthorName");
        existingItem.setIsPremium(false);

        InformationItem dupItem = new InformationItem();
        dupItem.setTitle("Dup Item");
        dupItem.setPlatform("BILIBILI");
        dupItem.setAuthor("Short");
        dupItem.setIsPremium(true);

        lenient().when(informationItemRepository.findTopByUserIdAndTitleAndPlatformOrderByCrawledAtDesc(
                any(), any(), any())).thenReturn(Optional.empty());
        lenient().when(informationItemRepository.findTopByUserIdAndUrlAndPlatformOrderByCrawledAtDesc(
                any(), any(), any())).thenReturn(Optional.empty());
        when(informationItemRepository.findTopByUserIdAndTitleAndPlatformOrderByCrawledAtDesc(
                eq(1L), eq("Dup Item"), eq("BILIBILI"))).thenReturn(Optional.of(existingItem));

        // When
        ResponseEntity<Map<String, Object>> response = controller.createInboxItemsBatch(List.of(dupItem));

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertEquals(0, body.get("count"));
        assertEquals(1, body.get("skipped"));
        assertEquals(0, body.get("failed"));
        verify(informationItemRepository, times(1)).save(existingItem);
        assertEquals("Short", existingItem.getAuthor());
        assertTrue(existingItem.getIsPremium());
        verify(analysisQueue, never()).offerAsync(anyLong());
    }

    // ========== P0 - createInboxItemsBatch for 循环异常捕获 ==========

    @Test
    @SuppressWarnings("unchecked")
    void createInboxItemsBatch_循环异常捕获_继续处理下一个() {
        // Given
        InformationItem item1 = new InformationItem();
        item1.setTitle("Failing Item");
        item1.setPlatform("BILIBILI");
        item1.setUrl("https://example.com/fail");

        InformationItem item2 = new InformationItem();
        item2.setTitle("Good Item");
        item2.setPlatform("GITHUB");
        item2.setUrl("https://github.com/repo");

        InformationItem savedItem = new InformationItem();
        savedItem.setId(2L);
        savedItem.setUserId(1L);
        savedItem.setTitle("Good Item");
        savedItem.setPlatform("GITHUB");

        lenient().when(informationItemRepository.findTopByUserIdAndTitleAndPlatformOrderByCrawledAtDesc(
                any(), any(), any())).thenReturn(Optional.empty());
        lenient().when(informationItemRepository.findTopByUserIdAndUrlAndPlatformOrderByCrawledAtDesc(
                any(), any(), any())).thenReturn(Optional.empty());
        when(informationItemRepository.save(any(InformationItem.class)))
                .thenThrow(new RuntimeException("DB error"))
                .thenReturn(savedItem);
        when(analysisQueue.offerAsync(anyLong())).thenReturn(mock(org.redisson.api.RFuture.class));

        // When
        ResponseEntity<Map<String, Object>> response = controller.createInboxItemsBatch(List.of(item1, item2));

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertEquals(1, body.get("count"));
        assertEquals(0, body.get("skipped"));
        assertEquals(1, body.get("failed"));
        verify(informationItemRepository, times(2)).save(any(InformationItem.class));
        verify(analysisQueue, times(1)).offerAsync(anyLong());
    }

    // ========== P0 - toggleLike / toggleFavorite 条目不存在路径 ==========

    @Test
    void toggleLike_条目不存在_返回404() {
        // Given
        when(informationItemRepository.findByIdAndUserId(99L, 1L)).thenReturn(Optional.empty());

        // When
        ResponseEntity<Map<String, Object>> response = controller.toggleLike(99L);

        // Then
        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
        verify(informationItemRepository, never()).updateIsLiked(anyLong(), anyBoolean());
    }

    @Test
    void toggleFavorite_条目不存在_返回404() {
        // Given
        when(informationItemRepository.findByIdAndUserId(99L, 1L)).thenReturn(Optional.empty());

        // When
        ResponseEntity<Map<String, Object>> response = controller.toggleFavorite(99L);

        // Then
        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
        verify(informationItemRepository, never()).updateIsFavorite(anyLong(), anyBoolean());
    }

    // ========== P0 - toggleLike / toggleFavorite catch 异常 ==========

    @Test
    void toggleLike_updateIsLiked异常_抛出RuntimeException() {
        // Given
        InformationItem item = new InformationItem();
        item.setId(1L);
        item.setUserId(1L);
        item.setIsLiked(false);

        when(informationItemRepository.findByIdAndUserId(1L, 1L)).thenReturn(Optional.of(item));
        doThrow(new RuntimeException("DB error")).when(informationItemRepository).updateIsLiked(1L, true);

        // When & Then
        assertThrows(RuntimeException.class, () -> controller.toggleLike(1L));
    }

    @Test
    void toggleFavorite_updateIsFavorite异常_抛出RuntimeException() {
        // Given
        InformationItem item = new InformationItem();
        item.setId(1L);
        item.setUserId(1L);
        item.setIsFavorite(false);

        when(informationItemRepository.findByIdAndUserId(1L, 1L)).thenReturn(Optional.of(item));
        doThrow(new RuntimeException("DB error")).when(informationItemRepository).updateIsFavorite(1L, true);

        // When & Then
        assertThrows(RuntimeException.class, () -> controller.toggleFavorite(1L));
    }

    // ========== P1 - createInboxItem 重复数据更新作者 ==========

    @Test
    void createInboxItem_重复数据_更新作者() {
        // Given
        InformationItem existingItem = new InformationItem();
        existingItem.setId(1L);
        existingItem.setUserId(1L);
        existingItem.setTitle("Test Item");
        existingItem.setPlatform("BILIBILI");
        existingItem.setAuthor(null);

        InformationItem incomingItem = new InformationItem();
        incomingItem.setTitle("Test Item");
        incomingItem.setPlatform("BILIBILI");
        incomingItem.setAuthor("NewAuthor");

        when(informationItemRepository.findTopByUserIdAndTitleAndPlatformOrderByCrawledAtDesc(
                eq(1L), eq("Test Item"), eq("BILIBILI"))).thenReturn(Optional.of(existingItem));

        // When
        ResponseEntity<InformationItem> response = controller.createInboxItem(incomingItem);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals("NewAuthor", response.getBody().getAuthor());
        verify(informationItemRepository, times(1)).save(existingItem);
        verify(analysisQueue, never()).offerAsync(anyLong());
    }

    // ========== P1 - createInboxItem 重复数据升格优质源 ==========

    @Test
    void createInboxItem_重复数据_升格优质源() {
        // Given
        InformationItem existingItem = new InformationItem();
        existingItem.setId(1L);
        existingItem.setUserId(1L);
        existingItem.setTitle("Test Item");
        existingItem.setPlatform("BILIBILI");
        existingItem.setIsPremium(false);

        InformationItem incomingItem = new InformationItem();
        incomingItem.setTitle("Test Item");
        incomingItem.setPlatform("BILIBILI");
        incomingItem.setIsPremium(true);

        when(informationItemRepository.findTopByUserIdAndTitleAndPlatformOrderByCrawledAtDesc(
                eq(1L), eq("Test Item"), eq("BILIBILI"))).thenReturn(Optional.of(existingItem));

        // When
        ResponseEntity<InformationItem> response = controller.createInboxItem(incomingItem);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertTrue(response.getBody().getIsPremium());
        verify(informationItemRepository, times(1)).save(existingItem);
        verify(analysisQueue, never()).offerAsync(anyLong());
    }

    // ========== P1 - updateInboxItem durationMinutes 处理 ==========

    @Test
    void updateInboxItem_durationMinutes为null_置空() {
        // Given
        InformationItem existingItem = new InformationItem();
        existingItem.setId(1L);
        existingItem.setUserId(1L);
        existingItem.setTitle("Original");
        existingItem.setDurationMinutes(10);

        Map<String, Object> updates = new java.util.HashMap<>();
        updates.put("durationMinutes", null);

        when(informationItemRepository.findByIdAndUserId(1L, 1L)).thenReturn(Optional.of(existingItem));
        when(informationItemRepository.save(any(InformationItem.class))).thenAnswer(i -> i.getArgument(0));

        // When
        ResponseEntity<InformationItem> response = controller.updateInboxItem(1L, updates);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertNull(response.getBody().getDurationMinutes());
    }

    @Test
    void updateInboxItem_durationMinutes数字转换() {
        // Given
        InformationItem existingItem = new InformationItem();
        existingItem.setId(1L);
        existingItem.setUserId(1L);
        existingItem.setTitle("Original");

        Map<String, Object> updates = new java.util.HashMap<>();
        updates.put("durationMinutes", 15);

        when(informationItemRepository.findByIdAndUserId(1L, 1L)).thenReturn(Optional.of(existingItem));
        when(informationItemRepository.save(any(InformationItem.class))).thenAnswer(i -> i.getArgument(0));

        // When
        ResponseEntity<InformationItem> response = controller.updateInboxItem(1L, updates);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals(Integer.valueOf(15), response.getBody().getDurationMinutes());
    }

    // ========== P1 - getInboxItems maxTotal 截断 ==========

    @Test
    @SuppressWarnings("unchecked")
    void getInboxItems_超过maxTotal_截断() {
        // Given
        List<InformationItem> items = new java.util.ArrayList<>();
        for (int i = 1; i <= 5; i++) {
            InformationItem item = new InformationItem();
            item.setId((long) i);
            item.setUserId(1L);
            item.setTitle("Item " + i);
            item.setPlatform("BILIBILI");
            item.setCrawledAt(LocalDateTime.now().plusSeconds(i));
            items.add(item);
        }

        Page<InformationItem> page = mock(Page.class);
        when(page.getContent()).thenReturn(items);
        when(informationItemRepository.findByUserId(eq(1L), any(PageRequest.class))).thenReturn(page);
        when(informationItemRepository.countByUserIdAndIsPremiumTrue(1L)).thenReturn(0L);
        when(informationItemRepository.countByUserIdAndAiSummaryIsNotNull(1L)).thenReturn(0L);

        // When - maxTotal=3
        ResponseEntity<Map<String, Object>> response = controller.getInboxItems(0, 100, 3, null, null);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        List<InformationItem> resultItems = (List<InformationItem>) body.get("items");
        assertEquals(3, resultItems.size());
        assertEquals(3L, body.get("totalItems"));
    }

    // ========== P2 - recordEngagement 分支 ==========

    @Test
    void recordEngagement_Url校验失败_返回400() {
        // Given - blank url
        Map<String, Object> payload = new java.util.HashMap<>();
        payload.put("url", "");
        payload.put("platform", "BILIBILI");
        payload.put("title", "Test Title");
        payload.put("deltaSeconds", 30);

        // When
        ResponseEntity<Map<String, Object>> response = controller.recordEngagement(payload);

        // Then
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
    }

    @Test
    @SuppressWarnings("unchecked")
    void recordEngagement_元数据标题时更新标题() {
        // Given
        InformationItem existingItem = new InformationItem();
        existingItem.setId(1L);
        existingItem.setUserId(1L);
        existingItem.setUrl("https://example.com/article");
        existingItem.setPlatform("BILIBILI");
        existingItem.setTitle("发布于 2024-01-01");
        existingItem.setWatchDurationSeconds(100);

        Map<String, Object> payload = new java.util.HashMap<>();
        payload.put("url", "https://example.com/article");
        payload.put("platform", "BILIBILI");
        payload.put("title", "Real Article Title");
        payload.put("deltaSeconds", 30);
        payload.put("author", "TestAuthor");

        InformationItem savedItem = new InformationItem();
        savedItem.setId(1L);
        savedItem.setUserId(1L);
        savedItem.setUrl("https://example.com/article");
        savedItem.setPlatform("BILIBILI");
        savedItem.setTitle("Real Article Title");
        savedItem.setWatchDurationSeconds(130);
        savedItem.setAuthor("TestAuthor");

        when(informationItemRepository.findTopByUserIdAndUrlAndPlatformOrderByCrawledAtDesc(
                eq(1L), eq("https://example.com/article"), eq("BILIBILI"))).thenReturn(Optional.of(existingItem));
        when(informationItemRepository.save(any(InformationItem.class))).thenReturn(savedItem);

        // When
        ResponseEntity<Map<String, Object>> response = controller.recordEngagement(payload);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertEquals(false, body.get("created"));
        // 验证标题从元数据标题更新为新标题
        assertEquals("Real Article Title", existingItem.getTitle());
        // 验证作者也被补充
        assertEquals("TestAuthor", existingItem.getAuthor());
        verify(informationItemRepository, times(1)).save(existingItem);
    }

    @Test
    @SuppressWarnings("unchecked")
    void recordEngagement_补充作者信息() {
        // Given
        InformationItem existingItem = new InformationItem();
        existingItem.setId(1L);
        existingItem.setUserId(1L);
        existingItem.setUrl("https://example.com/article");
        existingItem.setPlatform("BILIBILI");
        existingItem.setTitle("Existing Title");
        existingItem.setAuthor(null);
        existingItem.setWatchDurationSeconds(100);

        Map<String, Object> payload = new java.util.HashMap<>();
        payload.put("url", "https://example.com/article");
        payload.put("platform", "BILIBILI");
        payload.put("title", "Existing Title");
        payload.put("deltaSeconds", 30);
        payload.put("author", "NewAuthor");

        InformationItem savedItem = new InformationItem();
        savedItem.setId(1L);
        savedItem.setUserId(1L);
        savedItem.setUrl("https://example.com/article");
        savedItem.setPlatform("BILIBILI");
        savedItem.setTitle("Existing Title");
        savedItem.setAuthor("NewAuthor");
        savedItem.setWatchDurationSeconds(130);

        when(informationItemRepository.findTopByUserIdAndUrlAndPlatformOrderByCrawledAtDesc(
                eq(1L), eq("https://example.com/article"), eq("BILIBILI"))).thenReturn(Optional.of(existingItem));
        when(informationItemRepository.save(any(InformationItem.class))).thenReturn(savedItem);

        // When
        ResponseEntity<Map<String, Object>> response = controller.recordEngagement(payload);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertEquals(false, body.get("created"));
        assertEquals("NewAuthor", existingItem.getAuthor());
        verify(informationItemRepository, times(1)).save(existingItem);
    }

    @Test
    @SuppressWarnings("unchecked")
    void recordEngagement_deltaSeconds边界值1_成功处理() {
        // Given - deltaSeconds=1 是最小有效值
        InformationItem savedItem = new InformationItem();
        savedItem.setId(1L);
        savedItem.setUserId(1L);
        savedItem.setUrl("https://example.com/article");
        savedItem.setPlatform("BILIBILI");
        savedItem.setTitle("Test Article");
        savedItem.setWatchDurationSeconds(1);

        Map<String, Object> payload = new java.util.HashMap<>();
        payload.put("url", "https://example.com/article");
        payload.put("platform", "BILIBILI");
        payload.put("title", "Test Article");
        payload.put("deltaSeconds", 1);

        when(informationItemRepository.findTopByUserIdAndUrlAndPlatformOrderByCrawledAtDesc(
                eq(1L), eq("https://example.com/article"), eq("BILIBILI"))).thenReturn(Optional.empty());
        when(informationItemRepository.save(any(InformationItem.class))).thenReturn(savedItem);
        when(analysisQueue.offerAsync(anyLong())).thenReturn(mock(org.redisson.api.RFuture.class));

        // When
        ResponseEntity<Map<String, Object>> response = controller.recordEngagement(payload);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertEquals(true, body.get("created"));
        assertEquals(1, body.get("watchDurationSeconds"));
    }

    // ========== P2 - createInboxItemsBatch 知乎/小红书跳过 ==========

    @Test
    @SuppressWarnings("unchecked")
    void createInboxItemsBatch_全部为知乎小红书_全部跳过() {
        // Given - only XIAOHONGSHU and ZHIHU items, no valid items
        InformationItem xiaohongshuItem = new InformationItem();
        xiaohongshuItem.setTitle("小红书笔记");
        xiaohongshuItem.setPlatform("XIAOHONGSHU");

        InformationItem zhihuItem = new InformationItem();
        zhihuItem.setTitle("知乎文章");
        zhihuItem.setPlatform("ZHIHU");

        // When
        ResponseEntity<Map<String, Object>> response = controller.createInboxItemsBatch(
                List.of(xiaohongshuItem, zhihuItem));

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertEquals(0, body.get("count"));
        assertEquals(2, body.get("skipped"));
        assertEquals(0, body.get("failed"));
        verify(informationItemRepository, never()).save(any(InformationItem.class));
        verify(analysisQueue, never()).offerAsync(anyLong());
    }

    // ===== createTestItem =====

    @Test
    void createTestItem_InsertsAndReturns() {
        // Given
        InboxController.TestItemRequest request = new InboxController.TestItemRequest();
        request.setUserId(1L);
        request.setTitle("Test Article");
        request.setUrl("https://example.com/test");
        request.setPlatform("BILIBILI");
        request.setDurationMinutes(10);
        request.setContentRaw("Test content");

        InformationItem savedItem = new InformationItem();
        savedItem.setId(100L);
        savedItem.setUserId(1L);
        savedItem.setTitle("Test Article");

        when(informationItemRepository.save(any(InformationItem.class))).thenReturn(savedItem);

        // When
        ResponseEntity<?> response = controller.createTestItem(request);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        assertTrue((Boolean) body.get("success"));
        assertEquals(100L, body.get("itemId"));
        assertEquals("Test Article", body.get("title"));
        verify(informationItemRepository).save(any(InformationItem.class));
    }

    @Test
    void createTestItem_ReturnsBadRequest_WhenSaveFails() {
        // Given
        InboxController.TestItemRequest request = new InboxController.TestItemRequest();
        request.setUserId(1L);
        request.setTitle("Failing Item");

        when(informationItemRepository.save(any(InformationItem.class)))
                .thenThrow(new RuntimeException("DB error"));

        // When
        ResponseEntity<?> response = controller.createTestItem(request);

        // Then
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        assertFalse((Boolean) body.get("success"));
    }

    // ===== triggerKeywordAnalysis（远程新增：优质信息源自动触发关键词分析） =====

    @Test
    void createInboxItem_NewPremiumItem_TriggersKeywordAnalysis() {
        // Given
        InformationItem item = new InformationItem();
        item.setTitle("Premium New Item");
        item.setPlatform("BILIBILI");
        item.setIsPremium(true);

        InformationItem savedItem = new InformationItem();
        savedItem.setId(1L);
        savedItem.setUserId(1L);
        savedItem.setTitle("Premium New Item");
        savedItem.setPlatform("BILIBILI");
        savedItem.setIsPremium(true);

        when(informationItemRepository.findTopByUserIdAndTitleAndPlatformOrderByCrawledAtDesc(
                eq(1L), eq("Premium New Item"), eq("BILIBILI"))).thenReturn(Optional.empty());
        when(informationItemRepository.findTopByUserIdAndUrlAndPlatformOrderByCrawledAtDesc(
                any(), any(), any())).thenReturn(Optional.empty());
        when(informationItemRepository.save(any(InformationItem.class))).thenReturn(savedItem);
        when(analysisQueue.offerAsync(anyLong())).thenReturn(mock(org.redisson.api.RFuture.class));

        // When
        ResponseEntity<InformationItem> response = controller.createInboxItem(item);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        verify(keywordService, times(1)).analyzeAndApplyKeywordsAsync(savedItem, savedItem.getUserNote());
    }

    @Test
    void createInboxItem_NonPremiumItem_DoesNotTriggerKeywordAnalysis() {
        // Given
        InformationItem item = new InformationItem();
        item.setTitle("Regular New Item");
        item.setPlatform("BILIBILI");
        item.setIsPremium(false);

        InformationItem savedItem = new InformationItem();
        savedItem.setId(1L);
        savedItem.setUserId(1L);
        savedItem.setTitle("Regular New Item");
        savedItem.setPlatform("BILIBILI");
        savedItem.setIsPremium(false);

        when(informationItemRepository.findTopByUserIdAndTitleAndPlatformOrderByCrawledAtDesc(
                eq(1L), eq("Regular New Item"), eq("BILIBILI"))).thenReturn(Optional.empty());
        when(informationItemRepository.findTopByUserIdAndUrlAndPlatformOrderByCrawledAtDesc(
                any(), any(), any())).thenReturn(Optional.empty());
        when(informationItemRepository.save(any(InformationItem.class))).thenReturn(savedItem);
        when(analysisQueue.offerAsync(anyLong())).thenReturn(mock(org.redisson.api.RFuture.class));

        // When
        ResponseEntity<InformationItem> response = controller.createInboxItem(item);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        verify(keywordService, never()).analyzeAndApplyKeywordsAsync(any(), any());
    }

    @Test
    @SuppressWarnings("unchecked")
    void createInboxItemsBatch_NewPremiumItem_TriggersKeywordAnalysis() {
        // Given
        InformationItem item = new InformationItem();
        item.setTitle("Batch Premium Item");
        item.setPlatform("BILIBILI");
        item.setIsPremium(true);

        InformationItem savedItem = new InformationItem();
        savedItem.setId(1L);
        savedItem.setUserId(1L);
        savedItem.setTitle("Batch Premium Item");
        savedItem.setPlatform("BILIBILI");
        savedItem.setIsPremium(true);

        when(informationItemRepository.findTopByUserIdAndTitleAndPlatformOrderByCrawledAtDesc(
                any(), any(), any())).thenReturn(Optional.empty());
        when(informationItemRepository.findTopByUserIdAndUrlAndPlatformOrderByCrawledAtDesc(
                any(), any(), any())).thenReturn(Optional.empty());
        when(informationItemRepository.save(any(InformationItem.class))).thenReturn(savedItem);
        when(analysisQueue.offerAsync(anyLong())).thenReturn(mock(org.redisson.api.RFuture.class));

        // When
        ResponseEntity<Map<String, Object>> response = controller.createInboxItemsBatch(List.of(item));

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(1, response.getBody().get("count"));
        verify(keywordService, times(1)).analyzeAndApplyKeywordsAsync(savedItem, savedItem.getUserNote());
    }

    @Test
    void updateInboxItem_BecomesPremium_TriggersKeywordAnalysis() {
        // Given
        InformationItem existingItem = new InformationItem();
        existingItem.setId(1L);
        existingItem.setUserId(1L);
        existingItem.setTitle("Original");
        existingItem.setIsPremium(false);

        InformationItem updatedItem = new InformationItem();
        updatedItem.setId(1L);
        updatedItem.setUserId(1L);
        updatedItem.setTitle("Original");
        updatedItem.setIsPremium(true);

        when(informationItemRepository.findByIdAndUserId(1L, 1L)).thenReturn(Optional.of(existingItem));
        when(informationItemRepository.save(any(InformationItem.class))).thenReturn(updatedItem);

        // When
        ResponseEntity<InformationItem> response = controller.updateInboxItem(1L, Map.of("isPremium", true));

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertTrue(response.getBody().getIsPremium());
        verify(keywordService, times(1)).analyzeAndApplyKeywordsAsync(any(InformationItem.class), any());
    }

    @Test
    void updateInboxItem_AlreadyPremium_DoesNotTriggerAgain() {
        // Given
        InformationItem existingItem = new InformationItem();
        existingItem.setId(1L);
        existingItem.setUserId(1L);
        existingItem.setTitle("Original");
        existingItem.setIsPremium(true);

        InformationItem updatedItem = new InformationItem();
        updatedItem.setId(1L);
        updatedItem.setUserId(1L);
        updatedItem.setTitle("Original");
        updatedItem.setIsPremium(true);

        when(informationItemRepository.findByIdAndUserId(1L, 1L)).thenReturn(Optional.of(existingItem));
        when(informationItemRepository.save(any(InformationItem.class))).thenReturn(updatedItem);

        // When
        ResponseEntity<InformationItem> response = controller.updateInboxItem(1L, Map.of("isPremium", true));

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        verify(keywordService, never()).analyzeAndApplyKeywordsAsync(any(), any());
    }

    // ===== triggerKeywordAnalysis 私有方法守卫分支 =====

    @Test
    void triggerKeywordAnalysis_WithNullItem_Skips() {
        // When
        ReflectionTestUtils.invokeMethod(controller, "triggerKeywordAnalysis", (Object) null);

        // Then
        verify(keywordService, never()).analyzeAndApplyKeywordsAsync(any(), any());
    }

    @Test
    void triggerKeywordAnalysis_WithNullId_Skips() {
        // Given
        InformationItem item = new InformationItem();
        item.setId(null);
        item.setIsPremium(true);

        // When
        ReflectionTestUtils.invokeMethod(controller, "triggerKeywordAnalysis", item);

        // Then
        verify(keywordService, never()).analyzeAndApplyKeywordsAsync(any(), any());
    }

    @Test
    void triggerKeywordAnalysis_WithNonPremium_Skips() {
        // Given
        InformationItem item = new InformationItem();
        item.setId(1L);
        item.setIsPremium(false);

        // When
        ReflectionTestUtils.invokeMethod(controller, "triggerKeywordAnalysis", item);

        // Then
        verify(keywordService, never()).analyzeAndApplyKeywordsAsync(any(), any());
    }

    @Test
    void triggerKeywordAnalysis_WithPremiumItem_CallsKeywordService() {
        // Given
        InformationItem item = new InformationItem();
        item.setId(1L);
        item.setIsPremium(true);
        item.setUserNote("我的笔记");

        // When
        ReflectionTestUtils.invokeMethod(controller, "triggerKeywordAnalysis", item);

        // Then
        verify(keywordService, times(1)).analyzeAndApplyKeywordsAsync(item, "我的笔记");
    }
}
