package com.infodigest.controller;

import com.infodigest.entity.InformationItem;
import com.infodigest.entity.User;
import com.infodigest.repository.InformationItemRepository;
import com.infodigest.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/inbox")
public class InboxController {

    @Autowired
    private InformationItemRepository informationItemRepository;

    @Autowired
    private UserRepository userRepository;

    // 获取当前登录用户的所有信息项
    @GetMapping("/items")
    public ResponseEntity<List<InformationItem>> getInboxItems() {
        Long userId = getCurrentUserId();
        List<InformationItem> items = informationItemRepository.findByUserId(userId);
        return ResponseEntity.ok(items);
    }

    // 获取单个信息项
    @GetMapping("/items/{id}")
    public ResponseEntity<InformationItem> getInboxItem(@PathVariable Long id) {
        Long userId = getCurrentUserId();
        Optional<InformationItem> item = informationItemRepository.findByIdAndUserId(id, userId);
        return item.map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // 创建新信息项
    @PostMapping("/items")
    public ResponseEntity<InformationItem> createInboxItem(@RequestBody InformationItem item) {
        Long userId = getCurrentUserId();
        item.setUserId(userId);
        InformationItem savedItem = informationItemRepository.save(item);
        return ResponseEntity.ok(savedItem);
    }

    // 更新信息项
    @PutMapping("/items/{id}")
    public ResponseEntity<InformationItem> updateInboxItem(@PathVariable Long id, @RequestBody InformationItem itemDetails) {
        Long userId = getCurrentUserId();
        Optional<InformationItem> existingItem = informationItemRepository.findByIdAndUserId(id, userId);
        
        if (existingItem.isPresent()) {
            InformationItem item = existingItem.get();
            item.setTitle(itemDetails.getTitle());
            item.setUrl(itemDetails.getUrl());
            item.setPlatform(itemDetails.getPlatform());
            item.setCategory(itemDetails.getCategory());
            item.setDurationMinutes(itemDetails.getDurationMinutes());
            item.setContentRaw(itemDetails.getContentRaw());
            item.setProcessStatus(itemDetails.getProcessStatus());
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

    // 获取当前登录用户的ID
    private Long getCurrentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        String username = authentication.getName();
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));
        return user.getId();
    }
}
