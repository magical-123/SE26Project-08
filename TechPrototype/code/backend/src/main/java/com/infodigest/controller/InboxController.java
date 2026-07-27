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
            @RequestParam(defaultValue = "1000") int maxTotal) {
        // 获取当前用户
        Long userId = getCurrentUserId();
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        // 取最近 1000 条做平台限流，避免小红书刷屏把 GitHub/B 站数据挤出首页
        PageRequest recentRequest = PageRequest.of(0, 1000, Sort.by(Sort.Direction.DESC, "crawledAt"));
        List<InformationItem> recentItems = informationItemRepository.findByUserId(userId, recentRequest).getContent();

        List<InformationItem> filteredItems = new ArrayList<>(recentItems);

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
                InformationItem existingItem = existing.get();
                if (shouldUpdateAuthor(existingItem.getAuthor(), item.getAuthor())) {
                    existingItem.setAuthor(item.getAuthor().trim());
                    informationItemRepository.save(existingItem);
                }
                System.out.println("[Inbox] 跳过重复数据: " + item.getTitle() + " (" + item.getPlatform() + ")");
                return ResponseEntity.ok(existingItem);
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
                // 小红书不接受推荐流/页面扫描产生的批量数据，只允许详情页浏览心跳接口写入。
                if ("XIAOHONGSHU".equalsIgnoreCase(item.getPlatform())
                        || "ZHIHU".equalsIgnoreCase(item.getPlatform())) {
                    skipped++;
                    log.info("[Inbox Batch] 跳过知乎/小红书批量数据，需由浏览行为上报: {}", item.getTitle());
                    continue;
                }

                // 浏览器页面里的“发布于/编辑于”是时间元信息，不是内容标题。
                // 在服务端再拦截一次，避免旧版扩展或其他采集端写入无效卡片。
                if (isMetadataTitle(item.getTitle())) {
                    skipped++;
                    log.warn("[Inbox Batch] 跳过无效元信息标题: {}", item.getTitle());
                    continue;
                }

                // 去重检查
                if (item.getTitle() != null && item.getPlatform() != null) {
                    Optional<InformationItem> existing = informationItemRepository
                            .findTopByUserIdAndTitleAndPlatformOrderByCrawledAtDesc(
                                    userId, item.getTitle(), item.getPlatform());
                    if (existing.isPresent()) {
                        InformationItem existingItem = existing.get();
                        boolean changed = false;
                        if (shouldUpdateAuthor(existingItem.getAuthor(), item.getAuthor())) {
                            existingItem.setAuthor(item.getAuthor().trim());
                            changed = true;
                        }
                        if (item.getWatchDurationSeconds() != null
                                && !item.getWatchDurationSeconds().equals(existingItem.getWatchDurationSeconds())) {
                            existingItem.setWatchDurationSeconds(item.getWatchDurationSeconds());
                            changed = true;
                        }
                        if (item.getCompletionRate() != null
                                && !item.getCompletionRate().equals(existingItem.getCompletionRate())) {
                            existingItem.setCompletionRate(item.getCompletionRate());
                            changed = true;
                        }
                        if (item.getDurationMinutes() != null
                                && !item.getDurationMinutes().equals(existingItem.getDurationMinutes())) {
                            existingItem.setDurationMinutes(item.getDurationMinutes());
                            changed = true;
                        }
                        if (item.getIsLiked() != null
                                && !item.getIsLiked().equals(existingItem.getIsLiked())) {
                            existingItem.setIsLiked(item.getIsLiked());
                            changed = true;
                        }
                        if (item.getIsFavorite() != null
                                && !item.getIsFavorite().equals(existingItem.getIsFavorite())) {
                            existingItem.setIsFavorite(item.getIsFavorite());
                            changed = true;
                        }
                        if (changed) {
                            informationItemRepository.save(existingItem);
                        }
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

    /**
     * 浏览器扩展上报实际阅读/观看时长的增量。
     * 只接受当前已认证用户的数据，并按 userId + url + platform 累加，
     * 不使用标题去重，避免同一内容的多次心跳丢失时长。
     */
    @Transactional
    @PostMapping("/items/engagement")
    public ResponseEntity<Map<String, Object>> recordEngagement(@RequestBody Map<String, Object> payload) {
        Long userId = getCurrentUserId();
        String url = stringValue(payload.get("url"));
        String platform = stringValue(payload.get("platform"));
        String title = stringValue(payload.get("title"));
        int deltaSeconds = intValue(payload.get("deltaSeconds"), 0);
        int contentDurationSeconds = intValue(payload.get("contentDurationSeconds"), 0);

        if (url == null || url.isBlank() || platform == null || platform.isBlank() || title == null || title.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "url、platform、title 为必填项"));
        }
        if (isMetadataTitle(title)) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "标题不能是发布时间或编辑时间"));
        }
        // 单次心跳最多一分钟，防止失焦或客户端异常造成不合理的累加。
        if (deltaSeconds < 1 || deltaSeconds > 60) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "deltaSeconds 必须在 1 到 60 之间"));
        }

        Optional<InformationItem> existing = informationItemRepository
                .findTopByUserIdAndUrlAndPlatformOrderByCrawledAtDesc(userId, url, platform);
        InformationItem item;
        boolean created = existing.isEmpty();
        if (created) {
            item = new InformationItem();
            item.setUserId(userId);
            item.setUrl(url);
            item.setPlatform(platform);
            item.setTitle(title.substring(0, Math.min(title.length(), 500)));
            item.setAuthor(stringValue(payload.get("author")));
            item.setCategory("深度知识");
            item.setContentRaw(truncate(stringValue(payload.get("contentRaw")), 4000));
            item.setProcessStatus("UNPROCESSED");
        } else {
            item = existing.get();
            if (isMetadataTitle(item.getTitle())) {
                item.setTitle(title.substring(0, Math.min(title.length(), 500)));
            }
            if ((item.getAuthor() == null || item.getAuthor().isBlank()) && stringValue(payload.get("author")) != null) {
                item.setAuthor(stringValue(payload.get("author")));
            }
        }

        int oldSeconds = item.getWatchDurationSeconds() == null ? 0 : item.getWatchDurationSeconds();
        item.setWatchDurationSeconds(Math.min(Integer.MAX_VALUE, oldSeconds + deltaSeconds));
        if (contentDurationSeconds > 0) {
            item.setDurationMinutes(Math.max(1, (int) Math.ceil(contentDurationSeconds / 60.0)));
            item.setCompletionRate(Math.min(1.0, item.getWatchDurationSeconds() / (double) contentDurationSeconds));
        }
        InformationItem saved = informationItemRepository.save(item);
        if (created) analysisQueue.offerAsync(saved.getId());

        return ResponseEntity.ok(Map.of(
                "success", true,
                "created", created,
                "itemId", saved.getId(),
                "watchDurationSeconds", saved.getWatchDurationSeconds(),
                "completionRate", saved.getCompletionRate() == null ? 0.0 : saved.getCompletionRate()
        ));
    }

    /** 清理扩展旧版本误把“发布于/编辑于”写成标题的条目，只影响当前用户。 */
    @Transactional
    @PostMapping("/items/cleanup-metadata-titles")
    public ResponseEntity<Map<String, Object>> cleanupMetadataTitleItems() {
        Long userId = getCurrentUserId();
        List<InformationItem> invalidItems = informationItemRepository.findByUserId(userId).stream()
                .filter(item -> isMetadataTitle(item.getTitle()))
                .toList();
        informationItemRepository.deleteAll(invalidItems);
        return ResponseEntity.ok(Map.of("success", true, "deleted", invalidItems.size()));
    }

    private static String stringValue(Object value) {
        return value instanceof String ? ((String) value).trim() : null;
    }

    private static int intValue(Object value, int defaultValue) {
        return value instanceof Number ? ((Number) value).intValue() : defaultValue;
    }

    private static String truncate(String value, int maxLength) {
        return value == null ? "" : value.substring(0, Math.min(value.length(), maxLength));
    }

    private static boolean isMetadataTitle(String title) {
        return title == null || title.isBlank()
                || title.startsWith("发布于")
                || title.startsWith("编辑于")
                || title.matches("^[?？]{2,}\\s*\\d{4}[-/.年\\s].*");
    }

    private static boolean isMissingAuthor(String author) {
        return author == null || author.isBlank() || "未知作者".equals(author.trim());
    }

    private static boolean shouldUpdateAuthor(String currentAuthor, String incomingAuthor) {
        if (isMissingAuthor(incomingAuthor)) return false;
        if (isMissingAuthor(currentAuthor)) return true;
        String current = currentAuthor.trim();
        String incoming = incomingAuthor.trim();
        return !current.equals(incoming) && current.length() > incoming.length() + 3;
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
            else if (updates.containsKey("note")) item.setUserNote((String) updates.get("note"));
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
}
