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
     * 返回格式：[{ id, name, initial, status, tags, activeColor }]
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
                // 根据 lastActiveAt 判断在线状态（5 分钟内活跃视为在线）
                boolean isOnline = friend != null && friend.getLastActiveAt() != null
                        && friend.getLastActiveAt().isAfter(java.time.LocalDateTime.now().minusMinutes(5));
                map.put("status", isOnline ? "在线" : "离线");
                map.put("isOnline", isOnline);
                map.put("tags", Collections.emptyList());
                map.put("activeColor", isOnline ? "#10B981" : "#9CA3AF");
                return map;
            }).collect(Collectors.toList());
            return ResponseEntity.ok(result);
        }

        // 数据库为空，返回空列表
        return ResponseEntity.ok(Collections.emptyList());
    }

    /**
     * 返回 PENDING 的好友请求（收到的和已发送的）
     * 返回格式：[{ id, requesterId, receiverId, username, direction: "received"|"sent", createdAt }]
     */
    @GetMapping("/requests")
    public ResponseEntity<List<Map<String, Object>>> getRequests() {
        Long userId = getCurrentUserId();

        List<Friendship> all = friendshipRepository.findByRequesterIdOrReceiverId(userId, userId);
        List<Map<String, Object>> result = all.stream()
                .filter(f -> f.getStatus() == FriendshipStatus.PENDING)
                .map(f -> {
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("id", f.getId());
                    item.put("requesterId", f.getRequesterId());
                    item.put("receiverId", f.getReceiverId());
                    item.put("createdAt", f.getCreatedAt());
                    boolean isReceived = f.getReceiverId().equals(userId);
                    item.put("direction", isReceived ? "received" : "sent");
                    // 拿到对方用户名
                    Long otherId = isReceived ? f.getRequesterId() : f.getReceiverId();
                    User other = userRepository.findById(otherId).orElse(null);
                    item.put("username", other != null ? other.getUsername() : "Unknown");
                    return item;
                })
                .collect(Collectors.toList());

        return ResponseEntity.ok(result);
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
        Long userId = getCurrentUserId();
        Friendship friendship = friendshipRepository.findById(id).orElse(null);
        if (friendship == null) return ResponseEntity.notFound().build();
        if (!userId.equals(friendship.getReceiverId())) return ResponseEntity.status(403).build();
        if (friendship.getStatus() != FriendshipStatus.PENDING) return ResponseEntity.badRequest().build();
        friendship.setStatus(FriendshipStatus.ACCEPTED);
        friendshipRepository.save(friendship);
        return ResponseEntity.ok().build();
    }

    /**
     * 拒绝好友请求（删除记录）
     */
    @DeleteMapping("/requests/{id}")
    public ResponseEntity<Void> rejectRequest(@PathVariable Long id) {
        Long userId = getCurrentUserId();
        Friendship friendship = friendshipRepository.findById(id).orElse(null);
        if (friendship == null) return ResponseEntity.notFound().build();
        if (!userId.equals(friendship.getRequesterId()) && !userId.equals(friendship.getReceiverId())) {
            return ResponseEntity.status(403).build();
        }
        friendshipRepository.delete(friendship);
        return ResponseEntity.ok().build();
    }

    /**
     * 搜索用户（按用户名模糊匹配，排除自己）
     */
    @GetMapping("/users/search")
    public ResponseEntity<List<Map<String, Object>>> searchUsers(@RequestParam String q) {
        Long userId = getCurrentUserId();
        List<User> users = userRepository.findByUsernameContainingIgnoreCase(q);
        List<Map<String, Object>> result = users.stream()
                .filter(u -> !u.getId().equals(userId))
                .map(u -> {
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("id", u.getId());
                    item.put("username", u.getUsername());
                    return item;
                })
                .collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    // ==================== 鉴权辅助 ====================

    private Long getCurrentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        String username = authentication.getName();
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));
        return user.getId();
    }

}
