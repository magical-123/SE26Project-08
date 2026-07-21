package com.infodigest.controller;

import com.infodigest.entity.Concept;
import com.infodigest.entity.InformationItem;
import com.infodigest.entity.ItemConcept;
import com.infodigest.entity.NodePosition;
import com.infodigest.entity.User;
import com.infodigest.repository.ConceptRepository;
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
        conceptRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/mappings")
    public ResponseEntity<ItemConcept> createMapping(@RequestBody ItemConcept mapping) {
        ItemConcept saved = itemConceptRepository.save(mapping);
        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/mappings/{id}")
    public ResponseEntity<Void> deleteMapping(@PathVariable Long id) {
        itemConceptRepository.deleteById(id);
        return ResponseEntity.noContent().build();
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

        // 1. 先从 item_concepts 表读取已有映射
        List<ItemConcept> mappings = premiumItemIds.isEmpty()
                ? Collections.emptyList()
                : itemConceptRepository.findByItemIdIn(premiumItemIds);

        Map<Long, List<Long>> itemToConcepts = new HashMap<>();
        for (ItemConcept mapping : mappings) {
            itemToConcepts.computeIfAbsent(mapping.getItemId(), k -> new ArrayList<>())
                    .add(mapping.getConceptId());
        }

        Map<String, Object> result = new HashMap<>();
        result.put("concepts", concepts);
        result.put("items", premiumItems);
        result.put("itemToConcepts", itemToConcepts);

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
    public ResponseEntity<List<Concept>> getItemKeywords(@PathVariable Long itemId) {
        Long userId = getCurrentUserId();
        
        List<ItemConcept> mappings = itemConceptRepository.findByItemId(itemId);
        if (mappings.isEmpty()) {
            return ResponseEntity.ok(Collections.emptyList());
        }
        
        List<Long> conceptIds = mappings.stream().map(ItemConcept::getConceptId).collect(Collectors.toList());
        List<Concept> userConcepts = conceptRepository.findByUserId(userId);
        
        List<Concept> itemConcepts = userConcepts.stream()
                .filter(c -> conceptIds.contains(c.getId()))
                .collect(Collectors.toList());
                
        return ResponseEntity.ok(itemConcepts);
    }

    @PutMapping("/item-keywords/{itemId}")
    public ResponseEntity<List<Concept>> updateItemKeywords(@PathVariable Long itemId, @RequestBody List<KeywordSuggestion> keywords) {
        Long userId = getCurrentUserId();
        
        keywordService.applyKeywords(itemId, userId, keywords);
        
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
