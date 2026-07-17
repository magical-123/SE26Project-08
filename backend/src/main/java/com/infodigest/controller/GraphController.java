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
        Set<Long> mappedItemIds = new HashSet<>();
        for (ItemConcept mapping : mappings) {
            itemToConcepts.computeIfAbsent(mapping.getItemId(), k -> new ArrayList<>())
                    .add(mapping.getConceptId());
            mappedItemIds.add(mapping.getItemId());
        }

        // 2. 对还没有映射的 premium 条目，根据 category 动态匹配 concept
        //    concept.name = "cat-" + category  <->  item.category 匹配
        Map<String, Long> categoryConceptMap = new HashMap<>();
        for (Concept c : concepts) {
            String name = c.getName();
            if (name != null && name.startsWith("cat-")) {
                categoryConceptMap.put(name.substring(4), c.getId());
            }
            // 也按 label 匹配（中文名直接等于 category）
            if (c.getLabel() != null) {
                categoryConceptMap.putIfAbsent(c.getLabel(), c.getId());
            }
        }

        for (InformationItem item : premiumItems) {
            if (mappedItemIds.contains(item.getId())) continue;
            String category = item.getCategory();
            if (category == null || category.isEmpty()) continue;

            Long conceptId = categoryConceptMap.get(category);
            if (conceptId != null) {
                itemToConcepts.computeIfAbsent(item.getId(), k -> new ArrayList<>())
                        .add(conceptId);
            }
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

    /**
     * 一键自动映射：遍历当前用户所有有分类的信息项，
     * 根据 category 自动创建概念和 ItemConcept 映射
     */
    @PostMapping("/auto-map")
    public ResponseEntity<Map<String, Object>> autoMapAll() {
        Long userId = getCurrentUserId();
        List<InformationItem> allItems = informationItemRepository.findByUserId(userId);

        int mappedCount = 0;
        int skippedCount = 0;

        for (InformationItem item : allItems) {
            String category = item.getCategory();
            if (category == null || category.isEmpty()) {
                skippedCount++;
                continue;
            }
            try {
                aiSummaryService.ensureConceptMapping(item);
                mappedCount++;
            } catch (Exception e) {
                skippedCount++;
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("success", true);
        result.put("mappedCount", mappedCount);
        result.put("skippedCount", skippedCount);
        result.put("totalItems", allItems.size());
        result.put("message", "已为 " + mappedCount + " 条信息创建概念映射，跳过 " + skippedCount + " 条（无分类）");
        return ResponseEntity.ok(result);
    }
}
