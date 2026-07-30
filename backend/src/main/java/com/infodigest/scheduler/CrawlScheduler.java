package com.infodigest.scheduler;

import com.infodigest.entity.User;
import com.infodigest.entity.UserPlatform;
import com.infodigest.repository.UserPlatformRepository;
import com.infodigest.repository.UserRepository;
import com.infodigest.security.JwtUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * 定时爬虫调度器：每隔 30 秒自动触发一次全平台抓取
 */
@Component
public class CrawlScheduler {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private UserPlatformRepository userPlatformRepository;

    @Autowired
    private JwtUtil jwtUtil;

    @Value("${crawler.api.url:http://crawler:3000/crawl}")
    private String crawlerApiUrl;

    /** 防止上一次爬虫周期还没结束就启动新的 */
    private final AtomicBoolean running = new AtomicBoolean(false);

    /** 记录正在抓取的 (userId, platform) 对，防止同一用户同平台并发 */
    private final Set<String> activeJobs = ConcurrentHashMap.newKeySet();

    /** 需要抓取的平台列表 */
    // 小红书只允许浏览器扩展按用户实际浏览行为上报，不参与后台定时抓取。
    private static final List<String> PLATFORMS = List.of("bilibili", "github");

    /**
     * 项目启动时执行一次，之后每隔 1 小时自动触发一次全平台爬虫
     */
    @Scheduled(initialDelay = 30000, fixedRate = 3600000)
    public void scheduledCrawl() {
        if (!running.compareAndSet(false, true)) {
            System.out.println("[CrawlScheduler] 上一次爬虫周期尚未结束，跳过本轮");
            return;
        }

        try {
            List<User> users = userRepository.findAll();
            if (users.isEmpty()) {
                System.out.println("[CrawlScheduler] 没有注册用户，跳过");
                return;
            }

            System.out.println("[CrawlScheduler] 开始定时抓取，用户数=" + users.size());

            for (User user : users) {
                List<UserPlatform> platforms = userPlatformRepository.findByUserId(user.getId());
                Set<String> connectedPlatforms = ConcurrentHashMap.newKeySet();
                for (UserPlatform up : platforms) {
                    // 只要有平台记录就视为已连接（含空凭证的小红书等）
                    connectedPlatforms.add(up.getPlatform().toLowerCase());
                }

                for (String platform : PLATFORMS) {
                    if (!connectedPlatforms.contains(platform)) {
                        continue;
                    }

                    String jobKey = user.getId() + ":" + platform;
                    if (!activeJobs.add(jobKey)) {
                        System.out.println("[CrawlScheduler] " + jobKey + " 正在抓取中，跳过");
                        continue;
                    }

                    // 异步启动爬虫进程
                    new Thread(() -> {
                        try {
                            crawlForUser(user, platform);
                        } finally {
                            activeJobs.remove(jobKey);
                        }
                    }, "crawl-" + user.getId() + "-" + platform).start();
                }
            }
        } catch (Exception e) {
            System.err.println("[CrawlScheduler] 调度异常: " + e.getMessage());
            e.printStackTrace();
        } finally {
            running.set(false);
        }
    }

    private void crawlForUser(User user, String platform) {
        try {
            String crawlerToken = jwtUtil.generateToken(user.getUsername(), user.getId());

            org.springframework.web.client.RestTemplate restTemplate = new org.springframework.web.client.RestTemplate();
            java.util.Map<String, Object> requestBody = new java.util.HashMap<>();
            requestBody.put("platform", platform);
            requestBody.put("authToken", crawlerToken);
            requestBody.put("userId", user.getId());

            System.out.println("[CrawlScheduler] 发送爬虫请求: user=" + user.getUsername() + " platform=" + platform);
            
            try {
                restTemplate.postForObject(crawlerApiUrl, requestBody, String.class);
            } catch (Exception ex) {
                System.err.println("[Crawler API Error] " + ex.getMessage());
            }
        } catch (Exception e) {
            System.err.println("[CrawlScheduler] 爬虫异常: user=" + user.getUsername()
                    + " platform=" + platform + " - " + e.getMessage());
        }
    }
}
