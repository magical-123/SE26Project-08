package com.infodigest.controller;

import com.infodigest.entity.InformationItem;
import com.infodigest.entity.User;
import com.infodigest.repository.InformationItemRepository;
import com.infodigest.repository.UserRepository;
import com.infodigest.service.AiSummaryService;
import com.infodigest.service.KeywordService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/inbox")
public class InboxController {

    @Autowired
    private InformationItemRepository informationItemRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private AiSummaryService aiSummaryService;

    @Autowired
    private KeywordService keywordService;

    // 获取当前登录用户的信息项（支持分页 + 小红书限流，总上限 1000 条）
    @GetMapping("/items")
    public ResponseEntity<Map<String, Object>> getInboxItems(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "1000") int size,
            @RequestParam(defaultValue = "4") int xiaohongshuLimit,
            @RequestParam(defaultValue = "1000") int maxTotal) {
        // 获取当前用户
        Long userId = getCurrentUserId();
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        // 取最近 1000 条做平台限流，避免小红书刷屏把 GitHub/B 站数据挤出首页
        PageRequest recentRequest = PageRequest.of(0, 1000, Sort.by(Sort.Direction.DESC, "crawledAt"));
        List<InformationItem> recentItems = informationItemRepository.findByUserId(userId, recentRequest).getContent();

        // 检查用户是否启用了"娱乐信息隐藏"
        boolean hideEntertainment = isEntertainmentHidden(user);

        List<InformationItem> filteredItems = new ArrayList<>();
        int xhsCount = 0;
        for (InformationItem item : recentItems) {
            // 跳过被隐藏的娱乐类信息（基于 knowledgeScore < 20）
            if (hideEntertainment && item.getKnowledgeScore() != null && item.getKnowledgeScore() < 20) {
                continue;
            }
            if ("XIAOHONGSHU".equalsIgnoreCase(item.getPlatform())) {
                if (xhsCount < xiaohongshuLimit) {
                    filteredItems.add(item);
                    xhsCount++;
                }
            } else {
                filteredItems.add(item);
            }
        }

        // 对合并后的结果再次按 crawledAt 降序排列
        filteredItems.sort((a, b) -> b.getCrawledAt().compareTo(a.getCrawledAt()));

        // 截取最新 maxTotal 条
        if (filteredItems.size() > maxTotal) {
            filteredItems = new ArrayList<>(filteredItems.subList(0, maxTotal));
        }

        // 手动分页
        int fromIndex = page * size;
        int total = filteredItems.size();
        int toIndex = Math.min(fromIndex + size, total);
        List<InformationItem> pageContent = fromIndex < total
                ? filteredItems.subList(fromIndex, toIndex)
                : Collections.emptyList();

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("items", pageContent);
        response.put("totalItems", (long) total);
        response.put("totalPages", (int) Math.ceil((double) total / size));
        response.put("currentPage", page);
        response.put("hasMore", toIndex < total);

        return ResponseEntity.ok(response);
    }

    // 获取单个信息项
    @GetMapping("/items/{id}")
    public ResponseEntity<InformationItem> getInboxItem(@PathVariable Long id) {
        Long userId = getCurrentUserId();
        Optional<InformationItem> item = informationItemRepository.findByIdAndUserId(id, userId);
        return item.map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // 创建新信息项（带去重：同标题+平台只保留最新一条）
    @PostMapping("/items")
    public ResponseEntity<InformationItem> createInboxItem(@RequestBody InformationItem item) {
        Long userId = getCurrentUserId();
        item.setUserId(userId);

        // 去重检查：同一用户下，同标题+平台已存在则直接跳过，不更新不重新分析
        if (item.getTitle() != null && item.getPlatform() != null) {
            Optional<InformationItem> existing = informationItemRepository
                    .findTopByUserIdAndTitleAndPlatformOrderByCrawledAtDesc(userId, item.getTitle(), item.getPlatform());
            if (existing.isPresent()) {
                System.out.println("[Inbox] 跳过重复数据: " + item.getTitle() + " (" + item.getPlatform() + ")");
                return ResponseEntity.ok(existing.get());
            }
        }

        InformationItem savedItem = informationItemRepository.save(item);

        // 异步触发 AI 摘要生成（不阻塞响应）
        aiSummaryService.generateSummaryAsync(savedItem);

        return ResponseEntity.ok(savedItem);
    }

    // 更新信息项（PATCH 语义：只更新非 null 字段，兼容部分更新）
    @PutMapping("/items/{id}")
    public ResponseEntity<InformationItem> updateInboxItem(@PathVariable Long id, @RequestBody InformationItem itemDetails) {
        Long userId = getCurrentUserId();
        Optional<InformationItem> existingItem = informationItemRepository.findByIdAndUserId(id, userId);
        
        if (existingItem.isPresent()) {
            InformationItem item = existingItem.get();
            // 只覆盖非 null 字段，避免全量覆盖导致 title 等必填字段被清空
            if (itemDetails.getTitle() != null) item.setTitle(itemDetails.getTitle());
            if (itemDetails.getUrl() != null) item.setUrl(itemDetails.getUrl());
            if (itemDetails.getPlatform() != null) item.setPlatform(itemDetails.getPlatform());
            if (itemDetails.getDurationMinutes() != null) item.setDurationMinutes(itemDetails.getDurationMinutes());
            if (itemDetails.getContentRaw() != null) item.setContentRaw(itemDetails.getContentRaw());
            if (itemDetails.getProcessStatus() != null) item.setProcessStatus(itemDetails.getProcessStatus());
            
            boolean premiumTriggered = Boolean.TRUE.equals(itemDetails.getIsPremium()) && !Boolean.TRUE.equals(item.getIsPremium());
            if (itemDetails.getIsPremium() != null) item.setIsPremium(itemDetails.getIsPremium());
            
            InformationItem updatedItem = informationItemRepository.save(item);
            
            if (premiumTriggered) {
                String note = itemDetails.getContentRaw() != null ? itemDetails.getContentRaw() : item.getContentRaw();
                keywordService.analyzeAndApplyKeywordsAsync(updatedItem, note);
            }
            
            return ResponseEntity.ok(updatedItem);
        } else {
            return ResponseEntity.notFound().build();
        }
    }

    // 删除信息项
    @DeleteMapping("/items/{id}")
    public ResponseEntity<Void> deleteInboxItem(@PathVariable Long id) {
        Long userId = getCurrentUserId();
        Optional<InformationItem> item = informationItemRepository.findByIdAndUserId(id, userId);

        if (item.isPresent()) {
            informationItemRepository.deleteById(id);
            return ResponseEntity.noContent().build();
        } else {
            return ResponseEntity.notFound().build();
        }
    }

    // 测试接口：无需认证直接插入（仅用于开发测试）
    @PostMapping("/test/items")
    public ResponseEntity<?> createTestItem(@RequestBody TestItemRequest request) {
        try {
            InformationItem item = new InformationItem();
            item.setUserId(request.getUserId());
            item.setTitle(request.getTitle());
            item.setUrl(request.getUrl());
            item.setPlatform(request.getPlatform());
            item.setDurationMinutes(request.getDurationMinutes());
            item.setContentRaw(request.getContentRaw());
            item.setProcessStatus("UNPROCESSED");

            InformationItem savedItem = informationItemRepository.save(item);

            return ResponseEntity.ok(java.util.Map.of(
                "success", true,
                "message", "视频插入成功",
                "itemId", savedItem.getId(),
                "title", savedItem.getTitle()
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(java.util.Map.of(
                "success", false,
                "message", "插入失败: " + e.getMessage()
            ));
        }
    }

    // DTO for test request
    public static class TestItemRequest {
        private Long userId;
        private String title;
        private String url;
        private String platform;
        private Integer durationMinutes;
        private String contentRaw;

        // Getters and Setters
        public Long getUserId() { return userId; }
        public void setUserId(Long userId) { this.userId = userId; }

        public String getTitle() { return title; }
        public void setTitle(String title) { this.title = title; }

        public String getUrl() { return url; }
        public void setUrl(String url) { this.url = url; }

        public String getPlatform() { return platform; }
        public void setPlatform(String platform) { this.platform = platform; }

        public Integer getDurationMinutes() { return durationMinutes; }
        public void setDurationMinutes(Integer durationMinutes) { this.durationMinutes = durationMinutes; }

        public String getContentRaw() { return contentRaw; }
        public void setContentRaw(String contentRaw) { this.contentRaw = contentRaw; }
    }

    // 获取当前登录用户的ID
    private Long getCurrentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        String username = authentication.getName();
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));
        return user.getId();
    }

    // 检查用户是否启用了"娱乐信息隐藏"
    private boolean isEntertainmentHidden(User user) {
        if (user.getHiddenPlatforms() == null) return false;
        try {
            // hiddenPlatforms 是 JSON 数组，例如 ["ENTERTAINMENT"]
            com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            String[] hidden = mapper.readValue(user.getHiddenPlatforms(), String[].class);
            for (String h : hidden) {
                if ("ENTERTAINMENT".equalsIgnoreCase(h)) return true;
            }
        } catch (Exception e) {
            return false;
        }
        return false;
    }
}
