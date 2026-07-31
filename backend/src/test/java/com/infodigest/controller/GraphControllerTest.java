package com.infodigest.controller;

import com.infodigest.entity.Concept;
import com.infodigest.entity.InformationItem;
import com.infodigest.entity.ItemConcept;
import com.infodigest.entity.NodePosition;
import com.infodigest.entity.User;
import com.infodigest.repository.ConceptRepository;
import com.infodigest.repository.FriendshipRepository;
import com.infodigest.repository.InformationItemRepository;
import com.infodigest.repository.ItemConceptRepository;
import com.infodigest.repository.NodePositionRepository;
import com.infodigest.repository.UserRepository;
import com.infodigest.service.AiSummaryService;
import com.infodigest.service.KeywordService;
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

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class GraphControllerTest {

    @Mock
    private ConceptRepository conceptRepository;

    @Mock
    private InformationItemRepository informationItemRepository;

    @Mock
    private ItemConceptRepository itemConceptRepository;

    @Mock
    private NodePositionRepository nodePositionRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private FriendshipRepository friendshipRepository;

    @Mock
    private AiSummaryService aiSummaryService;

    @Mock
    private KeywordService keywordService;

    @InjectMocks
    private GraphController controller;

    private final User currentUser = new User();

    @BeforeEach
    void setUp() {
        currentUser.setId(1L);
        currentUser.setUsername("testuser");
        when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(currentUser));
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("testuser", null, java.util.List.of()));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @SuppressWarnings("unchecked")
    @Test
    void getGraphData_ReturnsNodesAndEdges() {
        // Given
        Concept concept = new Concept();
        concept.setId(10L);
        concept.setUserId(1L);
        concept.setName("frontend-arch");
        concept.setLabel("前端架构演进");

        InformationItem item = new InformationItem();
        item.setId(100L);
        item.setUserId(1L);
        item.setTitle("React 19 新特性");
        item.setIsPremium(true);

        ItemConcept mapping = new ItemConcept();
        mapping.setItemId(100L);
        mapping.setConceptId(10L);
        mapping.setHighlighted(true);

        when(conceptRepository.findByUserId(1L)).thenReturn(List.of(concept));
        when(informationItemRepository.findByUserId(1L)).thenReturn(List.of(item));
        when(itemConceptRepository.findByItemIdIn(List.of(100L))).thenReturn(List.of(mapping));

        // When
        ResponseEntity<Map<String, Object>> response = controller.getGraphData();

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertNotNull(body.get("concepts"));
        assertNotNull(body.get("items"));
        assertNotNull(body.get("itemToConcepts"));
    }

    @Test
    void getGraphData_HandlesEmptyData() {
        // Given
        when(conceptRepository.findByUserId(1L)).thenReturn(Collections.emptyList());
        when(informationItemRepository.findByUserId(1L)).thenReturn(Collections.emptyList());

        // When
        ResponseEntity<Map<String, Object>> response = controller.getGraphData();

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertTrue(((List<?>) body.get("concepts")).isEmpty());
        assertTrue(((List<?>) body.get("items")).isEmpty());
    }

    @Test
    void updatePositions_SavesPositions() {
        // Given
        Map<String, Object> position1 = Map.of(
                "nodeId", "concept-10",
                "posX", 100.0,
                "posY", 200.0
        );
        Map<String, Object> position2 = Map.of(
                "nodeId", "concept-11",
                "posX", 300.0,
                "posY", 400.0
        );
        List<Map<String, Object>> positions = List.of(position1, position2);

        when(nodePositionRepository.findByUserIdAndNodeId(1L, "concept-10"))
                .thenReturn(Optional.empty());
        when(nodePositionRepository.findByUserIdAndNodeId(1L, "concept-11"))
                .thenReturn(Optional.empty());
        when(nodePositionRepository.save(any(NodePosition.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        // When
        ResponseEntity<Void> response = controller.savePositions(positions);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        verify(nodePositionRepository, times(2)).save(any(NodePosition.class));
    }

    @Test
    void getConcepts_ReturnsConcepts() {
        // Given
        Concept concept = new Concept();
        concept.setId(10L);
        concept.setUserId(1L);
        concept.setName("frontend-arch");
        concept.setLabel("前端架构演进");

        when(conceptRepository.findByUserId(1L)).thenReturn(List.of(concept));

        // When
        ResponseEntity<List<Concept>> response = controller.getConcepts();

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        List<Concept> body = response.getBody();
        assertNotNull(body);
        assertEquals(1, body.size());
        assertEquals("前端架构演进", body.get(0).getLabel());
    }

    @Test
    void getConcepts_ReturnsEmptyList() {
        // Given
        when(conceptRepository.findByUserId(1L)).thenReturn(java.util.Collections.emptyList());

        // When
        ResponseEntity<List<Concept>> response = controller.getConcepts();

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        List<Concept> body = response.getBody();
        assertNotNull(body);
        assertTrue(body.isEmpty());
    }

    @Test
    void createConcept_CreatesAndReturns() {
        // Given
        Concept concept = new Concept();
        concept.setName("test-concept");
        concept.setLabel("测试概念");

        Concept savedConcept = new Concept();
        savedConcept.setId(1L);
        savedConcept.setUserId(1L);
        savedConcept.setName("test-concept");
        savedConcept.setLabel("测试概念");

        when(conceptRepository.save(any(Concept.class))).thenReturn(savedConcept);

        // When
        ResponseEntity<Concept> response = controller.createConcept(concept);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals(1L, response.getBody().getId());
        assertEquals(1L, response.getBody().getUserId());
        assertEquals("测试概念", response.getBody().getLabel());
        verify(conceptRepository, times(1)).save(any(Concept.class));
    }

    @Test
    void updateConceptPositions_UpdatesPositions() {
        // Given
        Map<String, Object> position = Map.of(
                "id", 1L,
                "posX", 100.0,
                "posY", 200.0
        );
        List<Map<String, Object>> positions = List.of(position);

        Concept concept = new Concept();
        concept.setId(1L);
        concept.setUserId(1L);

        when(conceptRepository.findById(1L)).thenReturn(Optional.of(concept));
        when(conceptRepository.save(any(Concept.class))).thenAnswer(invocation -> invocation.getArgument(0));

        // When
        ResponseEntity<Void> response = controller.updateConceptPositions(positions);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        verify(conceptRepository, times(1)).save(any(Concept.class));
    }

    @Test
    void deleteConcept_DeletesConcept() {
        // Given
        Concept concept = new Concept();
        concept.setId(1L);
        concept.setUserId(1L);

        when(conceptRepository.findById(1L)).thenReturn(Optional.of(concept));

        // When
        ResponseEntity<Void> response = controller.deleteConcept(1L);

        // Then
        assertEquals(HttpStatus.NO_CONTENT, response.getStatusCode());
        verify(itemConceptRepository, times(1)).deleteByConceptId(1L);
        verify(conceptRepository, times(1)).deleteById(1L);
    }

    @Test
    void deleteConcept_ReturnsNotFound_WhenNotOwned() {
        // Given
        Concept concept = new Concept();
        concept.setId(1L);
        concept.setUserId(2L); // Different user

        when(conceptRepository.findById(1L)).thenReturn(Optional.of(concept));

        // When
        ResponseEntity<Void> response = controller.deleteConcept(1L);

        // Then
        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
        verify(itemConceptRepository, never()).deleteByConceptId(anyLong());
        verify(conceptRepository, never()).deleteById(anyLong());
    }

    @Test
    void createMapping_CreatesMapping() {
        // Given
        ItemConcept mapping = new ItemConcept();
        mapping.setItemId(1L);
        mapping.setConceptId(10L);

        InformationItem item = new InformationItem();
        item.setId(1L);

        Concept concept = new Concept();
        concept.setId(10L);
        concept.setUserId(1L);

        ItemConcept savedMapping = new ItemConcept();
        savedMapping.setId(100L);
        savedMapping.setItemId(1L);
        savedMapping.setConceptId(10L);

        when(informationItemRepository.findByIdAndUserId(1L, 1L)).thenReturn(Optional.of(item));
        when(conceptRepository.findById(10L)).thenReturn(Optional.of(concept));
        when(itemConceptRepository.save(any(ItemConcept.class))).thenReturn(savedMapping);

        // When
        ResponseEntity<ItemConcept> response = controller.createMapping(mapping);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals(100L, response.getBody().getId());
    }

    @Test
    void createMapping_ReturnsNotFound_WhenItemNotFound() {
        // Given
        ItemConcept mapping = new ItemConcept();
        mapping.setItemId(1L);
        mapping.setConceptId(10L);

        when(informationItemRepository.findByIdAndUserId(1L, 1L)).thenReturn(Optional.empty());

        // When
        ResponseEntity<ItemConcept> response = controller.createMapping(mapping);

        // Then
        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
        verify(itemConceptRepository, never()).save(any(ItemConcept.class));
    }

    @Test
    void deleteMapping_DeletesMapping() {
        // Given
        ItemConcept mapping = new ItemConcept();
        mapping.setId(100L);
        mapping.setItemId(1L);

        InformationItem item = new InformationItem();
        item.setId(1L);

        when(itemConceptRepository.findById(100L)).thenReturn(Optional.of(mapping));
        when(informationItemRepository.findByIdAndUserId(1L, 1L)).thenReturn(Optional.of(item));

        // When
        ResponseEntity<Void> response = controller.deleteMapping(100L);

        // Then
        assertEquals(HttpStatus.NO_CONTENT, response.getStatusCode());
        verify(itemConceptRepository, times(1)).deleteById(100L);
    }

    @Test
    void getPositions_ReturnsPositions() {
        // Given
        NodePosition position = NodePosition.builder()
                .nodeId("concept-1")
                .posX(100.0)
                .posY(200.0)
                .build();

        when(nodePositionRepository.findByUserId(1L)).thenReturn(List.of(position));

        // When
        ResponseEntity<Map<String, Map<String, Double>>> response = controller.getPositions();

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Map<String, Double>> body = response.getBody();
        assertNotNull(body);
        assertTrue(body.containsKey("concept-1"));
        assertEquals(100.0, body.get("concept-1").get("x"));
        assertEquals(200.0, body.get("concept-1").get("y"));
    }

    @Test
    void deletePositions_DeletesPositions() {
        // When
        ResponseEntity<Void> response = controller.deletePositions();

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        verify(nodePositionRepository, times(1)).deleteByUserId(1L);
    }

    @Test
    void analyzeKeywords_ReturnsKeywords() {
        // Given
        InformationItem item = new InformationItem();
        item.setId(1L);
        item.setUserId(1L);

        KeywordService.KeywordSuggestion kw = new KeywordService.KeywordSuggestion();
        kw.setLabel("测试关键词");
        kw.setNew(true);
        kw.setHighlighted(true);
        kw.setConfidence(0.95);
        kw.setReason("测试原因");

        when(informationItemRepository.findByIdAndUserId(1L, 1L)).thenReturn(Optional.of(item));
        when(keywordService.analyzeKeywords(item, null)).thenReturn(List.of(kw));

        // When
        ResponseEntity<List<KeywordService.KeywordSuggestion>> response = controller.analyzeKeywords(1L, null);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        List<KeywordService.KeywordSuggestion> body = response.getBody();
        assertNotNull(body);
        assertEquals(1, body.size());
        assertEquals("测试关键词", body.get(0).getLabel());
    }

    // ===== getUserGraphData =====

    @Test
    void getUserGraphData_WhenSameUser_RedirectsToGetGraphData() {
        // Given
        Concept concept = new Concept();
        concept.setId(10L);
        concept.setUserId(1L);
        concept.setLabel("测试概念");

        InformationItem item = new InformationItem();
        item.setId(100L);
        item.setUserId(1L);
        item.setTitle("测试文章");

        when(conceptRepository.findByUserId(1L)).thenReturn(List.of(concept));
        when(informationItemRepository.findByUserId(1L)).thenReturn(List.of(item));

        // When - userId == currentUserId (both 1L)
        ResponseEntity<Map<String, Object>> response = controller.getUserGraphData(1L);

        // Then - should delegate to getGraphData
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertNotNull(body.get("concepts"));
        assertNotNull(body.get("items"));
    }

    @Test
    void getUserGraphData_WhenNotFriend_Returns403() {
        // When - userId=2L is not a friend
        ResponseEntity<Map<String, Object>> response = controller.getUserGraphData(2L);

        // Then
        assertEquals(403, response.getStatusCode().value());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertTrue(((String) body.get("error")).contains("好友"));
    }

    @Test
    void getUserGraphData_WhenFriendNotFound_Returns404() {
        // Given - Setup friendship
        com.infodigest.entity.Friendship friendship = new com.infodigest.entity.Friendship();
        friendship.setRequesterId(1L);
        friendship.setReceiverId(2L);
        friendship.setStatus(com.infodigest.entity.FriendshipStatus.ACCEPTED);

        when(friendshipRepository.findByRequesterIdOrReceiverId(1L, 1L))
                .thenReturn(List.of(friendship));
        when(userRepository.findById(2L)).thenReturn(Optional.empty());

        // When
        ResponseEntity<Map<String, Object>> response = controller.getUserGraphData(2L);

        // Then
        assertEquals(404, response.getStatusCode().value());
    }

    @Test
    void getUserGraphData_WhenFriendIsPrivate_Returns403() {
        // Given - Setup friendship and private visibility
        com.infodigest.entity.Friendship friendship = new com.infodigest.entity.Friendship();
        friendship.setRequesterId(1L);
        friendship.setReceiverId(2L);
        friendship.setStatus(com.infodigest.entity.FriendshipStatus.ACCEPTED);

        User targetUser = new User();
        targetUser.setId(2L);
        targetUser.setDefaultVisibility(com.infodigest.entity.Visibility.PRIVATE);

        when(friendshipRepository.findByRequesterIdOrReceiverId(1L, 1L))
                .thenReturn(List.of(friendship));
        when(userRepository.findById(2L)).thenReturn(Optional.of(targetUser));

        // When
        ResponseEntity<Map<String, Object>> response = controller.getUserGraphData(2L);

        // Then
        assertEquals(403, response.getStatusCode().value());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertTrue(((String) body.get("error")).contains("公开分享"));
    }

    @SuppressWarnings("unchecked")
    @Test
    void getUserGraphData_WhenFriendWithData_ReturnsGraphData() {
        // Given - Setup friendship, visibility, and data
        com.infodigest.entity.Friendship friendship = new com.infodigest.entity.Friendship();
        friendship.setRequesterId(1L);
        friendship.setReceiverId(2L);
        friendship.setStatus(com.infodigest.entity.FriendshipStatus.ACCEPTED);

        User targetUser = new User();
        targetUser.setId(2L);
        targetUser.setDefaultVisibility(com.infodigest.entity.Visibility.PUBLIC);

        Concept concept = new Concept();
        concept.setId(10L);
        concept.setUserId(2L);
        concept.setLabel("好友概念");

        InformationItem item = new InformationItem();
        item.setId(100L);
        item.setUserId(2L);
        item.setTitle("好友文章");
        item.setIsPremium(true);

        when(friendshipRepository.findByRequesterIdOrReceiverId(1L, 1L))
                .thenReturn(List.of(friendship));
        when(userRepository.findById(2L)).thenReturn(Optional.of(targetUser));
        when(conceptRepository.findByUserId(2L)).thenReturn(List.of(concept));
        when(informationItemRepository.findByUserId(2L)).thenReturn(List.of(item));

        ItemConcept mapping = new ItemConcept();
        mapping.setItemId(100L);
        mapping.setConceptId(10L);

        when(itemConceptRepository.findByItemIdIn(List.of(100L))).thenReturn(List.of(mapping));
        when(nodePositionRepository.findByUserId(2L)).thenReturn(Collections.emptyList());

        // When
        ResponseEntity<Map<String, Object>> response = controller.getUserGraphData(2L);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertNotNull(body.get("concepts"));
        assertNotNull(body.get("items"));
        assertNotNull(body.get("positions"));
    }

    // ===== updateItemKeywords =====

    @Test
    void updateItemKeywords_WhenItemNotFound_Returns404() {
        // Given
        when(informationItemRepository.findByIdAndUserId(1L, 1L)).thenReturn(Optional.empty());

        // When
        ResponseEntity<List<KeywordService.KeywordSuggestion>> response =
                controller.updateItemKeywords(1L, Collections.emptyList());

        // Then
        assertEquals(404, response.getStatusCode().value());
        verify(keywordService, never()).applyKeywords(anyLong(), anyLong(), anyList());
    }

    @Test
    void updateItemKeywords_WhenItemFound_AppliesAndReturns() {
        // Given
        InformationItem item = new InformationItem();
        item.setId(1L);
        item.setUserId(1L);

        when(informationItemRepository.findByIdAndUserId(1L, 1L)).thenReturn(Optional.of(item));

        KeywordService.KeywordSuggestion kw = new KeywordService.KeywordSuggestion();
        kw.setLabel("关键词");
        List<KeywordService.KeywordSuggestion> keywords = List.of(kw);

        // getItemKeywords will use these mocks (called via return getItemKeywords(itemId))
        lenient().when(itemConceptRepository.findByItemId(1L)).thenReturn(Collections.emptyList());
        lenient().when(conceptRepository.findByUserId(1L)).thenReturn(Collections.emptyList());

        // When
        ResponseEntity<List<KeywordService.KeywordSuggestion>> response =
                controller.updateItemKeywords(1L, keywords);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        verify(keywordService).applyKeywords(1L, 1L, keywords);
    }

    // ===== toggleItemKeywordHighlight =====

    @Test
    void toggleItemKeywordHighlight_WhenLabelNull_Returns400() {
        // When
        ResponseEntity<List<KeywordService.KeywordSuggestion>> response =
                controller.toggleItemKeywordHighlight(1L, Map.of());

        // Then
        assertEquals(400, response.getStatusCode().value());
    }

    @Test
    void toggleItemKeywordHighlight_WhenItemNotFound_Returns404() {
        // Given
        when(informationItemRepository.findByIdAndUserId(1L, 1L)).thenReturn(Optional.empty());

        // When
        ResponseEntity<List<KeywordService.KeywordSuggestion>> response =
                controller.toggleItemKeywordHighlight(1L, Map.of("label", "测试"));

        // Then
        assertEquals(404, response.getStatusCode().value());
    }

    @Test
    void toggleItemKeywordHighlight_TogglesAndReturns() {
        // Given
        InformationItem item = new InformationItem();
        item.setId(1L);
        item.setUserId(1L);

        Concept concept = new Concept();
        concept.setId(10L);
        concept.setUserId(1L);
        concept.setLabel("测试");

        ItemConcept mapping = new ItemConcept();
        mapping.setItemId(1L);
        mapping.setConceptId(10L);
        mapping.setHighlighted(false);

        when(informationItemRepository.findByIdAndUserId(1L, 1L)).thenReturn(Optional.of(item));
        when(conceptRepository.findByUserIdAndLabel(1L, "测试")).thenReturn(Optional.of(concept));
        when(itemConceptRepository.findByItemIdAndConceptId(1L, 10L)).thenReturn(Optional.of(mapping));

        // getItemKeywords mocks (called via return)
        when(itemConceptRepository.findByItemId(1L)).thenReturn(List.of(mapping));
        when(conceptRepository.findByUserId(1L)).thenReturn(List.of(concept));

        // When
        ResponseEntity<List<KeywordService.KeywordSuggestion>> response =
                controller.toggleItemKeywordHighlight(1L, Map.of("label", "测试"));

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertTrue(mapping.getHighlighted()); // was false, now true
        verify(itemConceptRepository).save(mapping);
    }

    // ===== deleteKeyword =====

    @Test
    void deleteKeyword_WhenConceptExists_DeletesAndReturns204() {
        // Given
        Concept concept = new Concept();
        concept.setId(10L);
        concept.setUserId(1L);
        concept.setLabel("待删除");

        when(conceptRepository.findByUserIdAndLabel(1L, "待删除")).thenReturn(Optional.of(concept));

        // When
        ResponseEntity<Void> response = controller.deleteKeyword("待删除");

        // Then
        assertEquals(204, response.getStatusCode().value());
        verify(itemConceptRepository).deleteByConceptId(10L);
        verify(conceptRepository).delete(concept);
    }

    @Test
    void deleteKeyword_WhenConceptNotExists_Returns204() {
        // Given
        when(conceptRepository.findByUserIdAndLabel(1L, "不存在")).thenReturn(Optional.empty());

        // When
        ResponseEntity<Void> response = controller.deleteKeyword("不存在");

        // Then
        assertEquals(204, response.getStatusCode().value());
        verify(itemConceptRepository, never()).deleteByConceptId(anyLong());
        verify(conceptRepository, never()).delete(any());
    }

    @Test
    void getItemKeywords_ReturnsKeywords() {
        // Given
        InformationItem item = new InformationItem();
        item.setId(1L);
        item.setUserId(1L);

        ItemConcept mapping = new ItemConcept();
        mapping.setItemId(1L);
        mapping.setConceptId(10L);
        mapping.setHighlighted(true);
        mapping.setConfidence(0.9);
        mapping.setReason("相关");

        Concept concept = new Concept();
        concept.setId(10L);
        concept.setUserId(1L);
        concept.setLabel("关键词1");

        when(informationItemRepository.findByIdAndUserId(1L, 1L)).thenReturn(Optional.of(item));
        when(itemConceptRepository.findByItemId(1L)).thenReturn(List.of(mapping));
        when(conceptRepository.findByUserId(1L)).thenReturn(List.of(concept));

        // When
        ResponseEntity<List<KeywordService.KeywordSuggestion>> response = controller.getItemKeywords(1L);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        List<KeywordService.KeywordSuggestion> body = response.getBody();
        assertNotNull(body);
        assertEquals(1, body.size());
        assertEquals("关键词1", body.get(0).getLabel());
    }
}
