package com.infodigest.controller;

import com.infodigest.entity.QuoteExtract;
import com.infodigest.repository.QuoteExtractRepository;
import com.infodigest.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/quotes")
public class QuoteExtractController {

    @Autowired
    private QuoteExtractRepository quoteExtractRepository;

    @Autowired
    private UserRepository userRepository;

    /**
     * 获取当前用户的所有金句，按时间倒序
     */
    @GetMapping
    public ResponseEntity<List<QuoteExtract>> getQuotes(
            @RequestParam(required = false, defaultValue = "20") int limit) {
        Long userId = getCurrentUserId();
        List<QuoteExtract> quotes = quoteExtractRepository.findByUserIdOrderByCreatedAtDesc(userId);
        if (quotes.size() > limit) {
            quotes = quotes.subList(0, limit);
        }
        return ResponseEntity.ok(quotes);
    }

    private Long getCurrentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        String username = authentication.getName();
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"))
                .getId();
    }
}
