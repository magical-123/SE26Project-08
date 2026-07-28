package com.infodigest.controller;

import com.infodigest.entity.Concept;
import com.infodigest.entity.Friendship;
import com.infodigest.entity.FriendshipStatus;
import com.infodigest.entity.InformationItem;
import com.infodigest.entity.ItemConcept;
import com.infodigest.entity.NodePosition;
import com.infodigest.entity.User;
import com.infodigest.entity.Visibility;
import com.infodigest.repository.ConceptRepository;
import com.infodigest.repository.FriendshipRepository;
import com.infodigest.repository.InformationItemRepository;
import com.infodigest.repository.ItemConceptRepository;
import com.infodigest.repository.NodePositionRepository;
import com.infodigest.repository.UserRepository;
import com.infodigest.service.AiSummaryService;
import com.infodigest.service.KeywordService;
import com.infodigest.service.KeywordService.KeywordSuggestion;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/graph")
@RequiredArgsConstructor
public class GraphController {

    private final ConceptRepository conceptRepository;
    private final InformationItemRepository informationItemRepository;
    private final ItemConceptRepository itemConceptRepository;
    private final NodePositionRepository nodePositionRepository;
    private final UserRepository userRepository;
    private final FriendshipRepository friendshipRepository;
    private final AiSummaryService aiSummaryService;
    private final KeywordService keywordService;

    private Long getCurrentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        String username = authentication.getName();
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));
        return user.getId();
    }

    @GetMapping("/concepts")
    public ResponseEntity<List<Concept>> getConcepts() {
        Long userId = getCurrentUserId();
        List<Concept> concepts = conceptRepository.findByUserId(userId);
        return ResponseEntity.ok(concepts);
    }

    @PostMapping("/concepts")
    public ResponseEntity<Concept> createConcept(@RequestBody Concept concept) {
        Long userId = getCurrentUserId();
        concept.setUserId(userId);
        Concept saved = conceptRepository.save(concept);
        return ResponseEntity.ok(saved);
    }

    @PutMapping("/concepts/positions")
    public ResponseEntity<Void> updateConceptPositions(@RequestBody List<Map<String, Object>> positions) {
        Long userId = getCurrentUserId();
        for (Map<String, Object> pos : positions) {
            Long id = Long.valueOf(pos.get("id").toString());
            Double x = pos.get("posX") != null ? Double.valueOf(pos.get("posX").toString()) : null;
            Double y = pos.get("posY") != null ? Double.valueOf(pos.get("posY").toString()) : null;
            conceptRepository.findById(id).ifPresent(concept -> {
                if (!concept.getUserId().equals(userId)) return;
                concept.setPosX(x);
                concept.setPosY(y);
                conceptRepository.save(concept);
            });
        }
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/concepts/{id}")
    public ResponseEntity<Void> deleteConcept(@PathVariable Long id) {
        Long userId = getCurrentUserId();
        Optional<Concept> concept = conceptRepository.findById(id);
        if (concept.isEmpty() || !concept.get().getUserId().equals(userId)) {
            return ResponseEntity.notFound().build();
        }
        itemConceptRepository.deleteByConceptId(id);
        conceptRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/mappings")
    public ResponseEntity<ItemConcept> createMapping(@RequestBody ItemConcept mapping) {
        Long userId = getCurrentUserId();
        Optional<InformationItem> item = informationItemRepository.findByIdAndUserId(mapping.getItemId(), userId);
        Optional<Concept> concept = conceptRepository.findById(mapping.getConceptId());
        if (item.isEmpty() || concept.isEmpty() || !concept.get().getUserId().equals(userId)) {
            return ResponseEntity.notFound().build();
        }
        ItemConcept saved = itemConceptRepository.save(mapping);
        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/mappings/{id}")
    public ResponseEntity<Void> deleteMapping(@PathVariable Long id) {
        Long userId = getCurrentUserId();
        Optional<ItemConcept> mapping = itemConceptRepository.findById(id);
        if (mapping.isEmpty()
                || informationItemRepository.findByIdAndUserId(mapping.get().getItemId(), userId).isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        itemConceptRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/analyze-keywords/{itemId}")
    public ResponseEntity<List<KeywordSuggestion>> analyzeKeywords(@PathVariable Long itemId, @RequestBody Map<String, String> body) {
        Long userId = getCurrentUserId();
        String note = body != null ? body.get("note") : null;
        Optional<InformationItem> opt = informationItemRepository.findByIdAndUserId(itemId, userId);
        if (opt.isPresent()) {
            List<KeywordSuggestion> keywords = keywordService.analyzeKeywords(opt.get(), note);
            return ResponseEntity.ok(keywords);
        }
        return ResponseEntity.notFound().build();
    }

    @GetMapping("/data")
    public ResponseEntity<Map<String, Object>> getGraphData() {
        Long userId = getCurrentUserId();

        List<Concept> concepts = conceptRepository.findByUserId(userId);
        List<InformationItem> allItems = informationItemRepository.findByUserId(userId);

        List<InformationItem> premiumItems = allItems.stream()
                .filter(item -> Boolean.TRUE.equals(item.getHasNote()))
                .collect(Collectors.toList());

        List<Long> premiumItemIds = premiumItems.stream()
                .map(InformationItem::getId)
                .collect(Collectors.toList());

        // 从 item_concepts 表读取已有映射，仅保留高亮（highlighted=true）的
        List<ItemConcept> allMappings = premiumItemIds.isEmpty()
                ? Collections.emptyList()
                : itemConceptRepository.findByItemIdIn(premiumItemIds);
        List<ItemConcept> highlightedMappings = allMappings.stream()
                .filter(m -> Boolean.TRUE.equals(m.getHighlighted()))
                .collect(Collectors.toList());

        // 只保留至少有一个高亮映射的概念
        Set<Long> highlightedConceptIds = highlightedMappings.stream()
                .map(ItemConcept::getConceptId)
                .collect(Collectors.toSet());
        List<Concept> visibleConcepts = concepts.stream()
                .filter(c -> highlightedConceptIds.contains(c.getId()))
                .collect(Collectors.toList());

        Map<Long, List<Long>> itemToConcepts = new HashMap<>();
        for (ItemConcept mapping : highlightedMappings) {
            itemToConcepts.computeIfAbsent(mapping.getItemId(), k -> new ArrayList<>())
                    .add(mapping.getConceptId());
        }

        Map<String, Object> result = new HashMap<>();
        result.put("concepts", visibleConcepts);
        result.put("items", premiumItems);
        result.put("itemToConcepts", itemToConcepts);

        return ResponseEntity.ok(result);
    }

    /**
     * 查看好友的知识图谱数据（需是已接受的好友关系）
     */
    @GetMapping("/data/user/{userId}")
    public ResponseEntity<Map<String, Object>> getUserGraphData(@PathVariable Long userId) {
        Long currentUserId = getCurrentUserId();

        // 不能查看自己（用 /data 即可）
        if (currentUserId.equals(userId)) {
            return getGraphData();
        }

        // 检查是否是好友
        List<Friendship> friendships = friendshipRepository.findByRequesterIdOrReceiverId(currentUserId, currentUserId);
        boolean isFriend = friendships.stream().anyMatch(f ->
                f.getStatus() == FriendshipStatus.ACCEPTED &&
                (f.getRequesterId().equals(userId) || f.getReceiverId().equals(userId)));
        if (!isFriend) {
            return ResponseEntity.status(403).body(Map.of("error", "只能查看好友的知识图谱"));
        }

        // 检查目标用户是否公开了图谱
        User targetUser = userRepository.findById(userId).orElse(null);
        if (targetUser == null) {
            return ResponseEntity.status(404).body(Map.of("error", "用户不存在"));
        }
        if (targetUser.getDefaultVisibility() == Visibility.PRIVATE) {
            return ResponseEntity.status(403).body(Map.of("error", "对方已关闭数据公开分享"));
        }

        // 获取目标用户的概念和优质信息源
        List<Concept> concepts = conceptRepository.findByUserId(userId);
        List<InformationItem> allItems = informationItemRepository.findByUserId(userId);

        List<InformationItem> premiumItems = allItems.stream()
                .filter(item -> Boolean.TRUE.equals(item.getHasNote()))
                .collect(Collectors.toList());

        List<Long> premiumItemIds = premiumItems.stream()
                .map(InformationItem::getId)
                .collect(Collectors.toList());

        List<ItemConcept> mappings = premiumItemIds.isEmpty()
                ? Collections.emptyList()
                : itemConceptRepository.findByItemIdIn(premiumItemIds);

        Map<Long, List<Long>> itemToConcepts = new HashMap<>();
        for (ItemConcept mapping : mappings) {
            itemToConcepts.computeIfAbsent(mapping.getItemId(), k -> new ArrayList<>())
                    .add(mapping.getConceptId());
        }

        // 获取用户保存的节点位置
        List<NodePosition> nodePositions = nodePositionRepository.findByUserId(userId);
        Map<String, Map<String, Double>> positionsMap = new HashMap<>();
        for (NodePosition np : nodePositions) {
            Map<String, Double> pos = new HashMap<>();
            pos.put("x", np.getPosX());
            pos.put("y", np.getPosY());
            positionsMap.put(np.getNodeId(), pos);
        }

        Map<String, Object> result = new HashMap<>();
        result.put("concepts", concepts);
        result.put("items", premiumItems);
        result.put("itemToConcepts", itemToConcepts);
        result.put("positions", positionsMap);

        return ResponseEntity.ok(result);
    }

    @GetMapping("/positions")
    public ResponseEntity<Map<String, Map<String, Double>>> getPositions() {
        Long userId = getCurrentUserId();
        List<NodePosition> positions = nodePositionRepository.findByUserId(userId);
        Map<String, Map<String, Double>> result = new HashMap<>();
        for (NodePosition np : positions) {
            Map<String, Double> pos = new HashMap<>();
            pos.put("x", np.getPosX());
            pos.put("y", np.getPosY());
            result.put(np.getNodeId(), pos);
        }
        return ResponseEntity.ok(result);
    }

    @PutMapping("/positions")
    public ResponseEntity<Void> savePositions(@RequestBody List<Map<String, Object>> positions) {
        Long userId = getCurrentUserId();
        for (Map<String, Object> pos : positions) {
            String nodeId = pos.get("nodeId").toString();
            Double x = Double.valueOf(pos.get("posX").toString());
            Double y = Double.valueOf(pos.get("posY").toString());
            NodePosition np = nodePositionRepository.findByUserIdAndNodeId(userId, nodeId)
                    .orElse(NodePosition.builder().userId(userId).nodeId(nodeId).build());
            np.setPosX(x);
            np.setPosY(y);
            nodePositionRepository.save(np);
        }
        return ResponseEntity.ok().build();
    }

    @GetMapping("/item-keywords/{itemId}")
    public ResponseEntity<List<KeywordSuggestion>> getItemKeywords(@PathVariable Long itemId) {
        Long userId = getCurrentUserId();
        if (informationItemRepository.findByIdAndUserId(itemId, userId).isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        
        List<ItemConcept> mappings = itemConceptRepository.findByItemId(itemId);
        if (mappings.isEmpty()) {
            return ResponseEntity.ok(Collections.emptyList());
        }
        
        List<Long> conceptIds = mappings.stream().map(ItemConcept::getConceptId).collect(Collectors.toList());
        List<Concept> userConcepts = conceptRepository.findByUserId(userId);
        Map<Long, Boolean> highlightedMap = mappings.stream()
                .collect(Collectors.toMap(ItemConcept::getConceptId, ItemConcept::getHighlighted));
        
        List<KeywordSuggestion> result = userConcepts.stream()
                .filter(c -> conceptIds.contains(c.getId()))
                .map(c -> {
                    KeywordSuggestion ks = new KeywordSuggestion();
                    ks.setLabel(c.getLabel());
                    ks.setNew(false);
                    ks.setHighlighted(highlightedMap.getOrDefault(c.getId(), true));
                    mappings.stream().filter(m -> m.getConceptId().equals(c.getId())).findFirst().ifPresent(m -> {
                        ks.setConfidence(m.getConfidence());
                        ks.setReason(m.getReason());
                    });
                    return ks;
                })
                .collect(Collectors.toList());
                
        return ResponseEntity.ok(result);
    }

    @PutMapping("/item-keywords/{itemId}")
    public ResponseEntity<List<KeywordSuggestion>> updateItemKeywords(@PathVariable Long itemId, @RequestBody List<KeywordSuggestion> keywords) {
        Long userId = getCurrentUserId();
        if (informationItemRepository.findByIdAndUserId(itemId, userId).isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        
        keywordService.applyKeywords(itemId, userId, keywords);
        
        return getItemKeywords(itemId);
    }

    /**
     * 切换某关键词对某 item 的高亮状态
     */
    @PutMapping("/item-keywords/{itemId}/toggle")
    public ResponseEntity<List<KeywordSuggestion>> toggleItemKeywordHighlight(
            @PathVariable Long itemId,
            @RequestBody Map<String, Object> body) {
        Long userId = getCurrentUserId();
        String label = (String) body.get("label");
        if (label == null) {
            return ResponseEntity.badRequest().build();
        }
        if (informationItemRepository.findByIdAndUserId(itemId, userId).isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        
        conceptRepository.findByUserIdAndLabel(userId, label).ifPresent(concept -> {
            itemConceptRepository.findByItemIdAndConceptId(itemId, concept.getId()).ifPresent(mapping -> {
                mapping.setHighlighted(!Boolean.TRUE.equals(mapping.getHighlighted()));
                itemConceptRepository.save(mapping);
            });
        });
        
        return getItemKeywords(itemId);
    }

    @DeleteMapping("/keyword/{label}")
    @org.springframework.transaction.annotation.Transactional
    public ResponseEntity<Void> deleteKeyword(@PathVariable String label) {
        Long userId = getCurrentUserId();
        conceptRepository.findByUserIdAndLabel(userId, label).ifPresent(concept -> {
            itemConceptRepository.deleteByConceptId(concept.getId());
            conceptRepository.delete(concept);
        });
        return ResponseEntity.noContent().build();
    }
}
