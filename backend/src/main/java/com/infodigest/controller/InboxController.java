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
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.beans.factory.annotation.Qualifier;
import org.redisson.api.RBlockingDeque;

import lombok.extern.slf4j.Slf4j;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/inbox")
@Slf4j
public class InboxController {

    @Autowired
    private InformationItemRepository informationItemRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private AiSummaryService aiSummaryService;

    @Autowired
    private KeywordService keywordService;

    @Autowired
    @Qualifier("analysisQueue")
    private RBlockingDeque<Long> analysisQueue;

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

        // 将任务推入 Redis 队列由消费者处理
        analysisQueue.offerAsync(savedItem.getId());

        return ResponseEntity.ok(savedItem);
    }

    // 批量创建信息项（供浏览器扩展/爬虫使用）
    @PostMapping("/items/batch")
    public ResponseEntity<Map<String, Object>> createInboxItemsBatch(@RequestBody List<InformationItem> items) {
        Long userId = getCurrentUserId();

        int created = 0;
        int skipped = 0;
        int failed = 0;
        List<InformationItem> savedItems = new ArrayList<>();

        for (InformationItem item : items) {
            try {
                item.setUserId(userId);

                // 去重检查
                if (item.getTitle() != null && item.getPlatform() != null) {
                    Optional<InformationItem> existing = informationItemRepository
                            .findTopByUserIdAndTitleAndPlatformOrderByCrawledAtDesc(
                                    userId, item.getTitle(), item.getPlatform());
                    if (existing.isPresent()) {
                        skipped++;
                        continue;
                    }
                }

                InformationItem savedItem = informationItemRepository.save(item);
                savedItems.add(savedItem);
                created++;
            } catch (Exception e) {
                failed++;
                log.error("[Inbox Batch] 写入失败: {}", e.getMessage(), e);
            }
        }

        // 批量将任务推入 Redis 队列由消费者处理
        for (InformationItem savedItem : savedItems) {
            try {
                analysisQueue.offerAsync(savedItem.getId());
            } catch (Exception e) {
                log.error("[Inbox Batch] 任务入队失败 itemId={}: {}", savedItem.getId(), e.getMessage());
            }
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("count", created);
        response.put("skipped", skipped);
        response.put("failed", failed);
        response.put("message", "成功 " + created + " 条，跳过 " + skipped + " 条，失败 " + failed + " 条");
        return ResponseEntity.ok(response);
    }

    // 更新信息项（真正的 PATCH 语义：只更新请求中明确包含的字段）
    // 使用 Map<String, Object> 代替 InformationItem，避免 Jackson 反序列化时
    // 用实体类的默认值（如 isPremium=false, processStatus="UNPROCESSED"）覆盖已保存的数据
    @PutMapping("/items/{id}")
    public ResponseEntity<InformationItem> updateInboxItem(@PathVariable Long id, @RequestBody Map<String, Object> updates) {
        Long userId = getCurrentUserId();
        Optional<InformationItem> existingItem = informationItemRepository.findByIdAndUserId(id, userId);
        
        if (existingItem.isPresent()) {
            InformationItem item = existingItem.get();
            
            if (updates.containsKey("title")) item.setTitle((String) updates.get("title"));
            if (updates.containsKey("url")) item.setUrl((String) updates.get("url"));
            if (updates.containsKey("platform")) item.setPlatform((String) updates.get("platform"));
            if (updates.containsKey("durationMinutes")) {
                Object val = updates.get("durationMinutes");
                item.setDurationMinutes(val != null ? ((Number) val).intValue() : null);
            }
            if (updates.containsKey("contentRaw")) item.setContentRaw((String) updates.get("contentRaw"));
            if (updates.containsKey("processStatus")) item.setProcessStatus((String) updates.get("processStatus"));
            if (updates.containsKey("userNote")) item.setUserNote((String) updates.get("userNote"));
            if (updates.containsKey("isPremium")) item.setIsPremium((Boolean) updates.get("isPremium"));
            if (updates.containsKey("isLiked")) item.setIsLiked((Boolean) updates.get("isLiked"));
            if (updates.containsKey("isFavorite")) item.setIsFavorite((Boolean) updates.get("isFavorite"));
            
            InformationItem updatedItem = informationItemRepository.save(item);
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

    // 切换点赞
    @Transactional
    @PostMapping("/items/{id}/like")
    public ResponseEntity<Map<String, Object>> toggleLike(@PathVariable Long id) {
        Long userId = getCurrentUserId();
        log.info("[Like] userId={}, itemId={}", userId, id);
        Optional<InformationItem> opt = informationItemRepository.findByIdAndUserId(id, userId);
        if (opt.isEmpty()) {
            log.warn("[Like] Item {} not found for user {}", id, userId);
            return ResponseEntity.notFound().build();
        }
        InformationItem item = opt.get();
        boolean newLiked = !Boolean.TRUE.equals(item.getIsLiked());
        try {
            informationItemRepository.updateIsLiked(id, newLiked);
            log.info("[Like] Success: itemId={}, newLiked={}", id, newLiked);
        } catch (Exception e) {
            log.error("[Like] DB update failed for item {}: {}", id, e.getMessage(), e);
            throw new RuntimeException("点赞操作失败: " + e.getMessage(), e);
        }
        item.setIsLiked(newLiked);
        return ResponseEntity.ok(Map.of("id", id, "isLiked", newLiked));
    }

    // 切换收藏
    @Transactional
    @PostMapping("/items/{id}/favorite")
    public ResponseEntity<Map<String, Object>> toggleFavorite(@PathVariable Long id) {
        Long userId = getCurrentUserId();
        log.info("[Favorite] userId={}, itemId={}", userId, id);
        Optional<InformationItem> opt = informationItemRepository.findByIdAndUserId(id, userId);
        if (opt.isEmpty()) {
            log.warn("[Favorite] Item {} not found for user {}", id, userId);
            return ResponseEntity.notFound().build();
        }
        InformationItem item = opt.get();
        boolean newFav = !Boolean.TRUE.equals(item.getIsFavorite());
        try {
            informationItemRepository.updateIsFavorite(id, newFav);
            log.info("[Favorite] Success: itemId={}, newFav={}", id, newFav);
        } catch (Exception e) {
            log.error("[Favorite] DB update failed for item {}: {}", id, e.getMessage(), e);
            throw new RuntimeException("收藏操作失败: " + e.getMessage(), e);
        }
        item.setIsFavorite(newFav);
        return ResponseEntity.ok(Map.of("id", id, "isFavorite", newFav));
    }

    /**
     * 为单条卡片重新触发 AI 摘要生成。
     */
    @PostMapping("/items/{id}/regenerate-summary")
    public ResponseEntity<Map<String, Object>> regenerateSummary(@PathVariable Long id) {
        Long userId = getCurrentUserId();
        Optional<InformationItem> opt = informationItemRepository.findByIdAndUserId(id, userId);
        if (opt.isEmpty()) return ResponseEntity.notFound().build();

        InformationItem item = opt.get();
        if ("FAILED".equals(item.getProcessStatus())) {
            informationItemRepository.updateProcessStatus(id, "UNPROCESSED");
        }
        analysisQueue.offerAsync(item.getId());

        return ResponseEntity.ok(Map.of(
                "success", true,
                "itemId", id,
                "message", "已重新触发该卡片的 AI 摘要生成"
        ));
    }

    /**
     * 一次性修复：为当前用户所有缺少 AI 摘要的卡片触发摘要生成。
     * 仅手动调用，不会周期性自动执行，避免浪费 API 配额。
     * 同时会把之前 FAILED 的条目重置为 UNPROCESSED，方便调度器重新做营养分析。
     */
    @PostMapping("/fix-missing-summaries")
    public ResponseEntity<Map<String, Object>> fixMissingSummaries() {
        Long userId = getCurrentUserId();
        log.info("[FixMissingSummaries] 开始修复用户 {} 的无摘要卡片", userId);
        List<InformationItem> items = informationItemRepository.findByUserId(userId).stream()
                .filter(i -> i.getAiSummary() == null || i.getAiSummary().isEmpty())
                .toList();
        log.info("[FixMissingSummaries] 用户 {} 共有 {} 条无摘要卡片待修复", userId, items.size());

        int triggered = 0;
        int resetFailed = 0;
        for (InformationItem item : items) {
            try {
                // 重置 FAILED 状态，让营养分析调度器也能重新处理
                if ("FAILED".equals(item.getProcessStatus())) {
                    item.setProcessStatus("UNPROCESSED");
                    informationItemRepository.updateProcessStatus(item.getId(), "UNPROCESSED");
                    resetFailed++;
                }
                analysisQueue.offerAsync(item.getId());
                triggered++;
            } catch (Exception e) {
                log.error("[FixMissingSummaries] 任务入队失败 item {}: {}", item.getId(), e.getMessage());
            }
        }

        log.info("[FixMissingSummaries] 用户 {} 已触发 {} 条卡片摘要生成，重置 {} 条 FAILED 状态",
                userId, triggered, resetFailed);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "userId", userId,
                "missingCount", items.size(),
                "triggered", triggered,
                "resetFailed", resetFailed,
                "message", "已为 " + triggered + " 条无摘要卡片触发 AI 摘要生成（重置 " + resetFailed + " 条失败状态）"
        ));
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
