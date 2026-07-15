package com.infodigest.controller;

import com.infodigest.entity.ReviewCard;
import com.infodigest.repository.ReviewCardRepository;
import com.infodigest.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/review-cards")
public class ReviewCardController {

    @Autowired
    private ReviewCardRepository reviewCardRepository;

    @Autowired
    private UserRepository userRepository;

    // 获取当前用户的复习卡片（按指定日期）
    @GetMapping
    public ResponseEntity<List<ReviewCard>> getReviewCards(
            @RequestParam(required = false) LocalDate date) {
        Long userId = getCurrentUserId();
        LocalDate reviewDate = date != null ? date : LocalDate.now();
        List<ReviewCard> cards = reviewCardRepository.findByUserIdAndScheduledReviewDate(userId, reviewDate);
        return ResponseEntity.ok(cards);
    }

    // 获取单个复习卡片
    @GetMapping("/{id}")
    public ResponseEntity<ReviewCard> getReviewCard(@PathVariable Long id) {
        Long userId = getCurrentUserId();
        Optional<ReviewCard> card = reviewCardRepository.findById(id);
        if (card.isPresent() && card.get().getUserId().equals(userId)) {
            return ResponseEntity.ok(card.get());
        }
        return ResponseEntity.notFound().build();
    }

    // 创建复习卡片
    @PostMapping
    public ResponseEntity<ReviewCard> createReviewCard(@RequestBody ReviewCard card) {
        Long userId = getCurrentUserId();
        card.setUserId(userId);
        card.setScheduledReviewDate(LocalDate.now());
        ReviewCard savedCard = reviewCardRepository.save(card);
        return ResponseEntity.ok(savedCard);
    }

    // 更新复习卡片
    @PutMapping("/{id}")
    public ResponseEntity<ReviewCard> updateReviewCard(@PathVariable Long id, @RequestBody ReviewCard cardDetails) {
        Long userId = getCurrentUserId();
        Optional<ReviewCard> existingCard = reviewCardRepository.findById(id);
        
        if (existingCard.isPresent() && existingCard.get().getUserId().equals(userId)) {
            ReviewCard card = existingCard.get();
            card.setTitle(cardDetails.getTitle());
            card.setContent(cardDetails.getContent());
            card.setSourcePlatform(cardDetails.getSourcePlatform());
            if (cardDetails.getScheduledReviewDate() != null) {
                card.setScheduledReviewDate(cardDetails.getScheduledReviewDate());
            }
            ReviewCard updatedCard = reviewCardRepository.save(card);
            return ResponseEntity.ok(updatedCard);
        } else {
            return ResponseEntity.notFound().build();
        }
    }

    // 删除复习卡片
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteReviewCard(@PathVariable Long id) {
        Long userId = getCurrentUserId();
        Optional<ReviewCard> card = reviewCardRepository.findById(id);
        
        if (card.isPresent() && card.get().getUserId().equals(userId)) {
            reviewCardRepository.deleteById(id);
            return ResponseEntity.noContent().build();
        } else {
            return ResponseEntity.notFound().build();
        }
    }

    private Long getCurrentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        String username = authentication.getName();
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"))
                .getId();
    }
}
