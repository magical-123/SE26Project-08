package com.infodigest.controller;

import com.infodigest.entity.User;
import com.infodigest.entity.UserPlatform;
import com.infodigest.repository.UserPlatformRepository;
import com.infodigest.repository.UserRepository;
import com.infodigest.security.CredentialCryptoService;
import com.infodigest.security.JwtUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/crawl")
public class CrawlController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private UserPlatformRepository userPlatformRepository;

    @Autowired
    private CredentialCryptoService credentialCryptoService;

    // 爬虫脚本路径，相对于后端项目根目录
    @Value("${crawler.script.path:../crawler/index.js}")
    private String crawlerScriptPath;

    @Value("${crawler.api.url}")
    private String crawlerApiUrl;

    /**
     * 触发爬虫抓取指定平台
     * POST /api/crawl/trigger?platform=xiaohongshu
     * 
     * 后端生成当前用户的 JWT Token，通过命令行参数传给爬虫进程。
     * 爬虫使用后端传入的令牌认证，不依赖内置账号。
     */
    @PostMapping("/trigger")
    public ResponseEntity<Map<String, Object>> triggerCrawl(@RequestParam(defaultValue = "all") String platform) {
        Map<String, Object> result = new LinkedHashMap<>();

        if ("xiaohongshu".equalsIgnoreCase(platform) || "zhihu".equalsIgnoreCase(platform)) {
            result.put("status", "disabled");
            result.put("platform", platform.toLowerCase());
            result.put("message", "知乎和小红书仅通过浏览器扩展记录用户实际浏览的内容，不支持推荐流抓取");
            return ResponseEntity.badRequest().body(result);
        }
        
        try {
            // 获取当前认证用户
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            String username = authentication.getName();
            User user = userRepository.findByUsername(username)
                    .orElseThrow(() -> new RuntimeException("User not found"));

            if ("bilibili".equalsIgnoreCase(platform)) {
                Optional<UserPlatform> credential = userPlatformRepository
                        .findByUserIdAndPlatform(user.getId(), "BILIBILI");
                if (credential.isEmpty() || !isUsableBilibiliCredential(credential.get())) {
                    result.put("status", "reauth_required");
                    result.put("platform", "bilibili");
                    result.put("message", "B站授权凭证不可用，请前往设置页重新扫码登录");
                    return ResponseEntity.badRequest().body(result);
                }
            }
            
            // 生成该用户的 JWT Token（有效期 1 小时，足够爬虫使用）
            String crawlerToken = jwtUtil.generateToken(username, user.getId());
            
            // 通过 HTTP 调用独立的爬虫微服务
            Map<String, Object> requestBody = new HashMap<>();
            if (!"all".equalsIgnoreCase(platform)) {
                requestBody.put("platform", platform.toLowerCase());
            }
            requestBody.put("authToken", crawlerToken);
            requestBody.put("userId", user.getId());
            requestBody.put("limit", 10);

            org.springframework.web.client.RestTemplate restTemplate = new org.springframework.web.client.RestTemplate();
            restTemplate.postForObject(crawlerApiUrl, requestBody, Map.class);

            result.put("status", "started");
            result.put("platform", platform);
            result.put("user", username);
            result.put("message", "爬虫微服务已触发，数据将在几分钟内同步到 Inbox");
            return ResponseEntity.ok(result);

        } catch (Exception e) {
            result.put("status", "error");
            result.put("message", "启动爬虫失败: " + e.getMessage());
            result.put("platform", platform);
            return ResponseEntity.internalServerError().body(result);
        }
    }

    private boolean isUsableBilibiliCredential(UserPlatform userPlatform) {
        try {
            String credential = credentialCryptoService.decrypt(userPlatform.getCredential());
            if (credential == null || credential.isBlank()) return false;
            String normalized = credential.toLowerCase(Locale.ROOT);
            return normalized.contains("sessdata=")
                    && normalized.contains("bili_jct=")
                    && normalized.contains("dedeuserid=");
        } catch (RuntimeException ignored) {
            return false;
        }
    }
}
