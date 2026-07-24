package com.infodigest.controller;

import com.infodigest.entity.User;
import com.infodigest.repository.UserRepository;
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

    // 爬虫脚本路径，相对于后端项目根目录
    @Value("${crawler.script.path:../crawler/index.js}")
    private String crawlerScriptPath;

    /**
     * 触发爬虫抓取指定平台
     * POST /api/crawl/trigger?platform=xiaohongshu
     * 
     * 后端生成当前用户的 JWT Token，通过命令行参数传给爬虫进程。
     * 爬虫不再依赖 config.js 中硬编码的 testuser/testpass。
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
            
            // 生成该用户的 JWT Token（有效期 1 小时，足够爬虫使用）
            String crawlerToken = jwtUtil.generateToken(username, user.getId());
            
            // 构建命令：node index.js [--platform=xxx] --auth-token=xxx --user-id=xxx --limit=10
            // 手动触发（首次连接）抓取最近 10 条，避免大量历史数据涌入
            List<String> command = new ArrayList<>();
            command.add("node");
            command.add(crawlerScriptPath);
            if (!"all".equalsIgnoreCase(platform)) {
                command.add("--platform=" + platform.toLowerCase());
            }
            command.add("--auth-token=" + crawlerToken);
            command.add("--user-id=" + user.getId());
            command.add("--limit=10");

            ProcessBuilder processBuilder = new ProcessBuilder(command);
            // 设置工作目录。Spring Boot 运行时 user.dir 可能是项目根目录或 target
            String userDir = System.getProperty("user.dir");
            processBuilder.directory(new java.io.File(userDir));
            processBuilder.redirectErrorStream(true);

            Process process = processBuilder.start();

            // 异步读取输出
            new Thread(() -> {
                try (java.io.BufferedReader reader = new java.io.BufferedReader(
                        new java.io.InputStreamReader(process.getInputStream()))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        System.out.println("[Crawler-" + platform + "] " + line);
                    }
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }).start();

            result.put("status", "started");
            result.put("platform", platform);
            result.put("user", username);
            result.put("message", "爬虫已启动，数据将在几分钟内同步到 Inbox");
            return ResponseEntity.ok(result);

        } catch (Exception e) {
            result.put("status", "error");
            result.put("message", "启动爬虫失败: " + e.getMessage());
            result.put("platform", platform);
            return ResponseEntity.internalServerError().body(result);
        }
    }
}
