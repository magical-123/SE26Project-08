package com.infodigest.controller;

import com.infodigest.entity.Friendship;
import com.infodigest.entity.FriendshipStatus;
import com.infodigest.entity.User;
import com.infodigest.repository.FriendshipRepository;
import com.infodigest.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/social")
@RequiredArgsConstructor
public class SocialController {

    private final FriendshipRepository friendshipRepository;
    private final UserRepository userRepository;

    /**
     * 返回所有 ACCEPTED 好友列表。
     * 因目前 Friendship 表为空，返回 mock 数据。
     * 返回格式同 socialFriends：[{ id, name, initial, status, tags, activeColor }]
     */
    @GetMapping("/friends")
    public ResponseEntity<List<Map<String, Object>>> getFriends() {
        Long userId = getCurrentUserId();

        List<Friendship> friendships = friendshipRepository.findByRequesterIdOrReceiverId(userId, userId);

        List<Friendship> accepted = friendships.stream()
                .filter(f -> f.getStatus() == FriendshipStatus.ACCEPTED)
                .collect(Collectors.toList());

        if (!accepted.isEmpty()) {
            List<Map<String, Object>> result = accepted.stream().map(f -> {
                Long friendId = f.getRequesterId().equals(userId) ? f.getReceiverId() : f.getRequesterId();
                User friend = userRepository.findById(friendId).orElse(null);
                Map<String, Object> map = new LinkedHashMap<>();
                map.put("id", friendId);
                map.put("name", friend != null ? friend.getUsername() : "Unknown");
                map.put("initial", friend != null ? String.valueOf(friend.getUsername().charAt(0)).toUpperCase() : "?");
                // TODO: 从 UserProfile 或社交资料表中获取 status / tags / activeColor
                map.put("status", "在线");
                map.put("tags", Collections.emptyList());
                map.put("activeColor", "#10B981");
                return map;
            }).collect(Collectors.toList());
            return ResponseEntity.ok(result);
        }

        // 数据库为空，返回 mock 数据
        return ResponseEntity.ok(buildMockFriends());
    }

    /**
     * 返回 PENDING 的好友请求列表（当前用户为接收方）
     */
    @GetMapping("/requests")
    public ResponseEntity<List<Friendship>> getRequests() {
        Long userId = getCurrentUserId();

        List<Friendship> all = friendshipRepository.findByRequesterIdOrReceiverId(userId, userId);
        List<Friendship> pending = all.stream()
                .filter(f -> f.getStatus() == FriendshipStatus.PENDING && f.getReceiverId().equals(userId))
                .collect(Collectors.toList());

        return ResponseEntity.ok(pending);
    }

    /**
     * 发送好友请求（创建 Friendship 记录，状态为 PENDING）
     *
     * @param body JSON { "receiverId": number }
     */
    @PostMapping("/request")
    public ResponseEntity<Friendship> sendRequest(@RequestBody Map<String, Object> body) {
        Long userId = getCurrentUserId();
        Long receiverId = Long.valueOf(body.get("receiverId").toString());

        Friendship friendship = new Friendship();
        friendship.setRequesterId(userId);
        friendship.setReceiverId(receiverId);
        friendship.setStatus(FriendshipStatus.PENDING);

        Friendship saved = friendshipRepository.save(friendship);
        return ResponseEntity.ok(saved);
    }

    /**
     * 接受好友请求（将 PENDING 改为 ACCEPTED）
     */
    @PutMapping("/requests/{id}/accept")
    public ResponseEntity<Void> acceptRequest(@PathVariable Long id) {
        friendshipRepository.findById(id).ifPresent(friendship -> {
            friendship.setStatus(FriendshipStatus.ACCEPTED);
            friendshipRepository.save(friendship);
        });
        return ResponseEntity.ok().build();
    }

    // ==================== 鉴权辅助 ====================

    private Long getCurrentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        String username = authentication.getName();
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));
        return user.getId();
    }

    // ==================== Mock 数据构建 ====================

    private List<Map<String, Object>> buildMockFriends() {
        List<Map<String, Object>> friends = new ArrayList<>();

        friends.add(buildFriend(1L, "Alice", "A", "正在深入研究 AI",
                List.of("大模型", "提示词工程", "科幻"), "#10B981"));
        friends.add(buildFriend(2L, "Bob Design", "B", "寻找灵感中",
                List.of("UI/UX", "空间设计", "排版"), "#F59E0B"));
        friends.add(buildFriend(3L, "Charlie", "C", "摸鱼",
                List.of("单机游戏", "动漫", "影视解说"), "#F43F5E"));

        return friends;
    }

    private Map<String, Object> buildFriend(Long id, String name, String initial,
                                            String status, List<String> tags, String activeColor) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", id);
        item.put("name", name);
        item.put("initial", initial);
        item.put("status", status);
        item.put("tags", tags);
        item.put("activeColor", activeColor);
        return item;
    }
}
