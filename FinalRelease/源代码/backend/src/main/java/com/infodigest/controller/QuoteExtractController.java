package com.infodigest.controller;

import com.infodigest.entity.QuoteExtract;
import com.infodigest.repository.QuoteExtractRepository;
import com.infodigest.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

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
    public ResponseEntity<List<QuoteExtract>> getQuotes() {
        Long userId = getCurrentUserId();
        List<QuoteExtract> quotes = quoteExtractRepository.findByUserIdOrderByCreatedAtDesc(userId);
        if (quotes.size() > 20) {
            quotes = quotes.subList(0, 20);
        }
        return ResponseEntity.ok(quotes);
    }

    /**
     * 清除当前用户的所有金句（用于重新生成前清理旧数据）
     */
    @Transactional
    @DeleteMapping
    public ResponseEntity<Map<String, Object>> clearQuotes() {
        Long userId = getCurrentUserId();
        quoteExtractRepository.deleteByUserId(userId);
        return ResponseEntity.ok(Map.of("success", true, "message", "已清除所有金句"));
    }

    private Long getCurrentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        String username = authentication.getName();
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"))
                .getId();
    }
}
