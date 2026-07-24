package com.infodigest.controller;

import com.infodigest.entity.Friendship;
import com.infodigest.entity.FriendshipStatus;
import com.infodigest.entity.InformationItem;
import com.infodigest.entity.User;
import com.infodigest.entity.Visibility;
import com.infodigest.repository.FriendshipRepository;
import com.infodigest.repository.InformationItemRepository;
import com.infodigest.repository.UserRepository;
import com.infodigest.service.WordCloudService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.*;

@Slf4j
@RestController
@RequestMapping("/api/social/report")
@RequiredArgsConstructor
public class SocialReportController {

    private final FriendshipRepository friendshipRepository;
    private final UserRepository userRepository;
    private final InformationItemRepository informationItemRepository;
    private final WordCloudService wordCloudService;

    private Long getCurrentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        String username = authentication.getName();
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));
        return user.getId();
    }

    private boolean isFriend(Long currentUserId, Long targetUserId) {
        if (currentUserId.equals(targetUserId)) return true;
        List<Friendship> friendships = friendshipRepository.findByRequesterIdOrReceiverId(currentUserId, currentUserId);
        return friendships.stream().anyMatch(f ->
                f.getStatus() == FriendshipStatus.ACCEPTED &&
                (f.getRequesterId().equals(targetUserId) || f.getReceiverId().equals(targetUserId)));
    }

    private boolean isDataVisibleToFriend(Long targetUserId) {
        User targetUser = userRepository.findById(targetUserId).orElse(null);
        return targetUser != null && targetUser.getDefaultVisibility() != Visibility.PRIVATE;
    }

    /**
     * 查看好友的营养分类饼图数据
     */
    @GetMapping("/{userId}/nutrition")
    public ResponseEntity<?> getFriendNutrition(@PathVariable Long userId) {
        Long currentUserId = getCurrentUserId();
        if (!isFriend(currentUserId, userId)) {
            return ResponseEntity.status(403).body(Map.of("error", "只能查看好友的数据"));
        }
        if (!isDataVisibleToFriend(userId)) {
            return ResponseEntity.status(403).body(Map.of("error", "对方已关闭数据公开分享"));
        }

        List<InformationItem> analyzedItems = informationItemRepository
                .findByUserIdAndProcessStatus(userId, "PROCESSED");

        if (analyzedItems.isEmpty()) {
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("data", new ArrayList<>());
            response.put("totalHours", 0.0);
            return ResponseEntity.ok(response);
        }

        int totalProtein = 0, totalCarbs = 0, totalVitamins = 0, totalFats = 0, totalFiber = 0;
        for (InformationItem item : analyzedItems) {
            if (item.getNutritionProtein() != null) totalProtein += item.getNutritionProtein();
            if (item.getNutritionCarbs() != null) totalCarbs += item.getNutritionCarbs();
            if (item.getNutritionVitamins() != null) totalVitamins += item.getNutritionVitamins();
            if (item.getNutritionFats() != null) totalFats += item.getNutritionFats();
            if (item.getNutritionFiber() != null) totalFiber += item.getNutritionFiber();
        }

        int total = totalProtein + totalCarbs + totalVitamins + totalFats + totalFiber;
        if (total == 0) {
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("data", new ArrayList<>());
            response.put("totalHours", 0.0);
            return ResponseEntity.ok(response);
        }

        int proteinPercent = Math.round((float) totalProtein * 100 / total);
        int carbsPercent = Math.round((float) totalCarbs * 100 / total);
        int vitaminsPercent = Math.round((float) totalVitamins * 100 / total);
        int fatsPercent = Math.round((float) totalFats * 100 / total);
        int fiberPercent = Math.round((float) totalFiber * 100 / total);

        double totalHours = analyzedItems.stream()
                .filter(item -> item.getDurationMinutes() != null)
                .mapToInt(InformationItem::getDurationMinutes)
                .sum() / 60.0;
        totalHours = Math.round(totalHours * 100.0) / 100.0;

        List<Map<String, Object>> nutritionData = new ArrayList<>();
        nutritionData.add(Map.of("value", proteinPercent, "name", "深度知识", "itemStyle", Map.of("color", "#0EA5E9")));
        nutritionData.add(Map.of("value", carbsPercent, "name", "实用技能", "itemStyle", Map.of("color", "#F59E0B")));
        nutritionData.add(Map.of("value", vitaminsPercent, "name", "创意灵感", "itemStyle", Map.of("color", "#10B981")));
        nutritionData.add(Map.of("value", fatsPercent, "name", "纯娱乐", "itemStyle", Map.of("color", "#F43F5E")));
        nutritionData.add(Map.of("value", fiberPercent, "name", "哲思冥想", "itemStyle", Map.of("color", "#8B5CF6")));

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("data", nutritionData);
        response.put("totalHours", totalHours);

        return ResponseEntity.ok(response);
    }

    /**
     * 查看好友的今日词云数据
     */
    @GetMapping("/{userId}/wordcloud")
    public ResponseEntity<?> getFriendWordCloud(@PathVariable Long userId) {
        Long currentUserId = getCurrentUserId();
        if (!isFriend(currentUserId, userId)) {
            return ResponseEntity.status(403).body(Map.of("error", "只能查看好友的数据"));
        }
        if (!isDataVisibleToFriend(userId)) {
            return ResponseEntity.status(403).body(Map.of("error", "对方已关闭数据公开分享"));
        }

        LocalDate today = LocalDate.now();
        try {
            Map<String, Object> wordCloudData = wordCloudService.getWordCloud(userId, today);
            List<Map<String, Object>> keywords = wordCloudData != null
                    ? (List<Map<String, Object>>) wordCloudData.get("keywords")
                    : null;
            return ResponseEntity.ok(keywords != null ? keywords : new ArrayList<>());
        } catch (Exception e) {
            log.warn("获取好友词云失败 userId={}: {}", userId, e.getMessage());
            return ResponseEntity.ok(new ArrayList<>());
        }
    }
}
