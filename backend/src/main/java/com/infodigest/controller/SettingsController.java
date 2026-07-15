package com.infodigest.controller;

import com.infodigest.entity.User;
import com.infodigest.entity.UserPlatform;
import com.infodigest.repository.InformationItemRepository;
import com.infodigest.repository.UserPlatformRepository;
import com.infodigest.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.net.CookieManager;
import java.net.CookiePolicy;
import java.net.HttpCookie;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.Base64;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/settings")
public class SettingsController {

    @Autowired
    private InformationItemRepository informationItemRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private UserPlatformRepository userPlatformRepository;

    // ===== B 站扫码登录会话缓存 =====
    private static final ConcurrentHashMap<String, QrSession> BILI_QR_SESSIONS = new ConcurrentHashMap<>();
    private static final Duration QR_SESSION_TTL = Duration.ofMinutes(5);

    // ===== 知乎扫码登录会话缓存 =====
    private static final ConcurrentHashMap<String, ZhihuQrSession> ZHIHU_QR_SESSIONS = new ConcurrentHashMap<>();
    private static final Duration ZHIHU_QR_SESSION_TTL = Duration.ofMinutes(5);

    private static class QrSession {
        final String qrcodeKey;
        final HttpClient httpClient;
        final CookieManager cookieManager;
        final Instant createdAt;

        QrSession(String qrcodeKey, HttpClient httpClient, CookieManager cookieManager) {
            this.qrcodeKey = qrcodeKey;
            this.httpClient = httpClient;
            this.cookieManager = cookieManager;
            this.createdAt = Instant.now();
        }
    }

    private static class ZhihuQrSession {
        final String qrcodeKey;
        final HttpClient httpClient;
        final CookieManager cookieManager;
        final Instant createdAt;

        ZhihuQrSession(String qrcodeKey, HttpClient httpClient, CookieManager cookieManager) {
            this.qrcodeKey = qrcodeKey;
            this.httpClient = httpClient;
            this.cookieManager = cookieManager;
            this.createdAt = Instant.now();
        }
    }

    /**
     * 获取当前用户各平台的连接状态
     * 优先从 user_platforms 表读取，其次从 information_items 表判断
     */
    @GetMapping("/platforms")
    public ResponseEntity<Map<String, Object>> getPlatformStatus() {
        Long userId = getCurrentUserId();

        Map<String, Object> result = new LinkedHashMap<>();
        List<Map<String, Object>> platforms = new ArrayList<>();

        // 从 user_platforms 表读取各平台凭证状态
        List<UserPlatform> userPlatforms = userPlatformRepository.findByUserId(userId);
        Map<String, UserPlatform> platformMap = new HashMap<>();
        for (UserPlatform up : userPlatforms) {
            platformMap.put(up.getPlatform(), up);
        }

        // B 站
        boolean biliConnected = platformMap.containsKey("BILIBILI");
        long biliCount = informationItemRepository.countByUserIdAndPlatform(userId, "BILIBILI");
        platforms.add(buildPlatform("bilibili", "Bilibili", biliConnected || biliCount > 0,
                biliConnected ? "已通过 Cookie 授权" : (biliCount > 0 ? "已通过 Cookie 授权" : "未授权")));

        // 知乎
        boolean zhihuConnected = platformMap.containsKey("ZHIHU");
        long zhihuCount = informationItemRepository.countByUserIdAndPlatform(userId, "ZHIHU");
        platforms.add(buildPlatform("zhihu", "Zhihu", zhihuConnected || zhihuCount > 0,
                zhihuConnected ? "已通过 Cookie 授权" : (zhihuCount > 0 ? "已通过 Cookie 授权" : "未授权")));

        // 小红书
        boolean xhsConnected = platformMap.containsKey("XIAOHONGSHU");
        long xhsCount = informationItemRepository.countByUserIdAndPlatform(userId, "XIAOHONGSHU");
        platforms.add(buildPlatform("xiaohongshu", "小红书", xhsConnected || xhsCount > 0,
                xhsConnected ? "已连接" : (xhsCount > 0 ? "已连接" : "未授权")));

        // GitHub
        boolean githubConnected = platformMap.containsKey("GITHUB");
        platforms.add(buildPlatform("github", "GitHub", githubConnected,
                githubConnected ? "已通过 Token 授权" : "未授权"));

        result.put("platforms", platforms);
        return ResponseEntity.ok(result);
    }

    private Map<String, Object> buildPlatform(String key, String name, boolean connected, String desc) {
        Map<String, Object> platform = new LinkedHashMap<>();
        platform.put("key", key);
        platform.put("name", name);
        platform.put("connected", connected);
        platform.put("desc", desc);
        return platform;
    }

    /**
     * 获取当前用户各平台凭证（不返回 credential，仅返回连接状态）
     */
    @GetMapping("/platform-status")
    public ResponseEntity<Map<String, Object>> getPlatformDetailedStatus() {
        Long userId = getCurrentUserId();

        Map<String, Object> result = new LinkedHashMap<>();
        List<UserPlatform> userPlatforms = userPlatformRepository.findByUserId(userId);

        for (UserPlatform up : userPlatforms) {
            Map<String, Object> platform = new LinkedHashMap<>();
            platform.put("platform", up.getPlatform().toLowerCase());
            platform.put("connected", true);
            platform.put("updatedAt", up.getUpdatedAt().toString());
            result.put(up.getPlatform().toLowerCase(), platform);
        }

        return ResponseEntity.ok(result);
    }

    /**
     * 保存/更新平台凭证
     */
    @PostMapping("/platforms/{platform}/credential")
    public ResponseEntity<Map<String, Object>> savePlatformCredential(
            @PathVariable String platform,
            @RequestBody Map<String, String> request) {
        Long userId = getCurrentUserId();
        String credential = request.get("credential");

        if (credential == null) {
            Map<String, Object> error = new LinkedHashMap<>();
            error.put("error", "credential 不能为 null");
            return ResponseEntity.badRequest().body(error);
        }

        // 删除旧凭证（如果有）
        userPlatformRepository.findByUserIdAndPlatform(userId, platform.toUpperCase())
                .ifPresent(userPlatformRepository::delete);

        // 保存新凭证（允许空字符串，如小红书公开模式）
        UserPlatform userPlatform = new UserPlatform();
        userPlatform.setUserId(userId);
        userPlatform.setPlatform(platform.toUpperCase());
        userPlatform.setCredential(credential.trim());

        userPlatformRepository.save(userPlatform);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("message", "凭证保存成功");
        response.put("platform", platform);
        return ResponseEntity.ok(response);
    }

    /**
     * 删除平台凭证
     */
    @DeleteMapping("/platforms/{platform}")
    public ResponseEntity<Map<String, Object>> deletePlatformCredential(@PathVariable String platform) {
        Long userId = getCurrentUserId();

        // 同时删除该平台的数据和凭证
        informationItemRepository.findByUserId(userId).stream()
                .filter(item -> platform.equalsIgnoreCase(item.getPlatform()))
                .forEach(item -> informationItemRepository.deleteById(item.getId()));

        userPlatformRepository.findByUserIdAndPlatform(userId, platform.toUpperCase())
                .ifPresent(userPlatformRepository::delete);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("message", "已删除 " + platform + " 的授权和数据");
        return ResponseEntity.ok(response);
    }

    /**
     * 获取当前用户所有平台凭证（仅爬虫服务调用）
     * 返回格式：{ bilibili: {credential: "xxx"}, zhihu: {credential: "xxx"}, github: {credential: "xxx"} }
     */
    @GetMapping("/credentials")
    public ResponseEntity<Map<String, Object>> getUserCredentials() {
        Long userId = getCurrentUserId();
        List<UserPlatform> userPlatforms = userPlatformRepository.findByUserId(userId);

        Map<String, Object> result = new LinkedHashMap<>();
        for (UserPlatform up : userPlatforms) {
            Map<String, Object> cred = new LinkedHashMap<>();
            cred.put("credential", up.getCredential());
            cred.put("updatedAt", up.getUpdatedAt().toString());
            result.put(up.getPlatform().toLowerCase(), cred);
        }
        return ResponseEntity.ok(result);
    }

    /**
     * B 站扫码登录：获取二维码图片 URL 和 qrcodeKey（使用新版 API）
     */
    @GetMapping("/bilibili/qrcode")
    public ResponseEntity<Map<String, Object>> getBilibiliQrcode() {
        try {
            CookieManager cookieManager = new CookieManager();
            cookieManager.setCookiePolicy(CookiePolicy.ACCEPT_ALL);
            HttpClient httpClient = HttpClient.newBuilder()
                    .cookieHandler(cookieManager)
                    .connectTimeout(Duration.ofSeconds(10))
                    .build();

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("https://passport.bilibili.com/x/passport-login/web/qrcode/generate?source=main_web"))
                    .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
                    .header("Referer", "https://www.bilibili.com")
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            Map<String, Object> body = parseJson(response.body());

            if (body == null || !Integer.valueOf(0).equals(body.get("code"))) {
                return buildErrorResponse("B 站 API 返回数据异常: " + response.body());
            }

            @SuppressWarnings("unchecked")
            Map<String, Object> data = (Map<String, Object>) body.get("data");
            String qrcodeKey = data != null ? (String) data.get("qrcode_key") : null;
            String url = data != null ? (String) data.get("url") : null;

            if (qrcodeKey == null || url == null) {
                return buildErrorResponse("B 站 API 返回字段缺失");
            }

            QrSession session = new QrSession(qrcodeKey, httpClient, cookieManager);
            BILI_QR_SESSIONS.put(qrcodeKey, session);
            cleanExpiredBilibiliSessions();

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("qrcodeUrl", url);
            result.put("qrcodeKey", qrcodeKey);
            result.put("oauthKey", qrcodeKey); // 兼容旧前端字段
            return ResponseEntity.ok(result);

        } catch (Exception e) {
            return buildErrorResponse("获取 B 站二维码失败: " + e.getMessage());
        }
    }

    /**
     * B 站扫码登录：轮询登录状态（使用新版 API）
     * 返回 status: -1=等待扫描, 0=已扫描待确认, 1=成功, 2=已过期
     */
    @GetMapping("/bilibili/poll/{qrcodeKey}")
    public ResponseEntity<Map<String, Object>> pollBilibiliQrcode(@PathVariable String qrcodeKey) {
        QrSession session = BILI_QR_SESSIONS.get(qrcodeKey);
        if (session == null) {
            return buildErrorResponse("二维码会话已过期，请重新获取");
        }

        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("https://passport.bilibili.com/x/passport-login/web/qrcode/poll?qrcode_key=" + qrcodeKey))
                    .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
                    .header("Referer", "https://www.bilibili.com")
                    .GET()
                    .build();

            HttpResponse<String> response = session.httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            Map<String, Object> body = parseJson(response.body());

            if (body == null) {
                return buildErrorResponse("轮询返回数据异常");
            }

            @SuppressWarnings("unchecked")
            Map<String, Object> data = (Map<String, Object>) body.get("data");
            Integer code = data != null ? (Integer) data.get("code") : null;

            int status;
            String message;
            boolean success = false;

            switch (code != null ? code : -1) {
                case 0:
                    status = 1;
                    message = "登录成功";
                    success = true;
                    String cookieStr = extractCookies(session.cookieManager);
                    saveBilibiliCredential(cookieStr);
                    BILI_QR_SESSIONS.remove(qrcodeKey);
                    break;
                case 86090:
                    status = 0;
                    message = "已扫描，请在手机上确认登录";
                    break;
                case 86038:
                    status = 2;
                    message = "二维码已过期，请重试";
                    BILI_QR_SESSIONS.remove(qrcodeKey);
                    break;
                case 86101:
                default:
                    status = -1;
                    message = "请使用 B 站 App 扫描二维码";
                    break;
            }

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("status", status);
            result.put("message", message);
            result.put("success", success);
            return ResponseEntity.ok(result);

        } catch (Exception e) {
            return buildErrorResponse("轮询 B 站登录状态失败: " + e.getMessage());
        }
    }

    // ===== B 站扫码登录辅助方法 =====

    private String extractCookies(CookieManager cookieManager) {
        List<HttpCookie> cookies = cookieManager.getCookieStore().getCookies();
        return cookies.stream()
                .map(c -> c.getName() + "=" + c.getValue())
                .collect(Collectors.joining("; "));
    }

    private void saveBilibiliCredential(String cookieStr) {
        Long userId = getCurrentUserId();
        userPlatformRepository.findByUserIdAndPlatform(userId, "BILIBILI")
                .ifPresent(userPlatformRepository::delete);

        UserPlatform userPlatform = new UserPlatform();
        userPlatform.setUserId(userId);
        userPlatform.setPlatform("BILIBILI");
        userPlatform.setCredential(cookieStr);
        userPlatformRepository.save(userPlatform);
    }

    private void cleanExpiredBilibiliSessions() {
        Instant now = Instant.now();
        BILI_QR_SESSIONS.entrySet().removeIf(entry ->
                Duration.between(entry.getValue().createdAt, now).compareTo(QR_SESSION_TTL) > 0);
    }

    // ===== 知乎扫码登录 =====

    /**
     * 知乎扫码登录：调用知乎官方二维码 API，返回二维码图片（Base64 Data URL）
     */
    @GetMapping("/zhihu/qrcode")
    public ResponseEntity<Map<String, Object>> getZhihuQrcode() {
        try {
            CookieManager cookieManager = new CookieManager();
            cookieManager.setCookiePolicy(CookiePolicy.ACCEPT_ALL);
            HttpClient httpClient = HttpClient.newBuilder()
                    .cookieHandler(cookieManager)
                    .connectTimeout(Duration.ofSeconds(10))
                    .followRedirects(HttpClient.Redirect.NORMAL)
                    .build();

            String userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
            String referer = "https://www.zhihu.com/signin";

            // 1. 先请求 udid 获取 d_c0 cookie
            HttpRequest udidRequest = HttpRequest.newBuilder()
                    .uri(URI.create("https://www.zhihu.com/udid"))
                    .header("User-Agent", userAgent)
                    .header("Referer", referer)
                    .timeout(Duration.ofSeconds(15))
                    .POST(HttpRequest.BodyPublishers.noBody())
                    .build();
            HttpResponse<String> udidResp = httpClient.send(udidRequest, HttpResponse.BodyHandlers.ofString());
            System.out.println("[ZhihuQR] udid status: " + udidResp.statusCode());

            // 2. 请求二维码 token
            HttpRequest tokenRequest = HttpRequest.newBuilder()
                    .uri(URI.create("https://www.zhihu.com/api/v3/account/api/login/qrcode"))
                    .header("User-Agent", userAgent)
                    .header("Referer", referer)
                    .header("x-requested-with", "fetch")
                    .timeout(Duration.ofSeconds(15))
                    .POST(HttpRequest.BodyPublishers.noBody())
                    .build();
            HttpResponse<String> tokenResponse = httpClient.send(tokenRequest, HttpResponse.BodyHandlers.ofString());
            System.out.println("[ZhihuQR] token status: " + tokenResponse.statusCode() + " body: " + tokenResponse.body().substring(0, Math.min(200, tokenResponse.body().length())));

            Map<String, Object> tokenBody = parseJson(tokenResponse.body());
            if (tokenBody == null) {
                return buildErrorResponse("获取知乎二维码 token 失败: " + tokenResponse.body().substring(0, Math.min(300, tokenResponse.body().length())));
            }
            String token = tokenBody.get("token") instanceof String ? (String) tokenBody.get("token") : null;
            if (token == null || token.isEmpty()) {
                return buildErrorResponse("知乎二维码 token 为空: " + tokenResponse.body().substring(0, Math.min(300, tokenResponse.body().length())));
            }

            // 3. 知乎返回的 link 就是二维码内容（与图片等价），前端据此生成二维码
            String link = tokenBody.get("link") instanceof String ? (String) tokenBody.get("link") : null;
            if (link == null || link.isEmpty()) {
                link = "https://www.zhihu.com/account/scan/login/" + token;
            }

            ZhihuQrSession session = new ZhihuQrSession(token, httpClient, cookieManager);
            ZHIHU_QR_SESSIONS.put(token, session);
            cleanExpiredZhihuSessions();

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("qrcodeKey", token);
            result.put("qrcodeLink", link);
            return ResponseEntity.ok(result);

        } catch (java.net.http.HttpTimeoutException e) {
            System.err.println("[ZhihuQR] TIMEOUT: " + e.getMessage());
            return buildErrorResponse("获取知乎二维码超时，请稍后重试: " + e.getMessage());
        } catch (Exception e) {
            System.err.println("[ZhihuQR] ERROR: " + e.getMessage());
            e.printStackTrace();
            return buildErrorResponse("获取知乎二维码失败: " + e.getMessage());
        }
    }

    /**
     * 知乎扫码登录：轮询 scan_info 状态
     * 返回 status: -1=等待扫描, 0=已扫描待确认, 1=成功, 2=已过期
     */
    @GetMapping("/zhihu/poll/{qrcodeKey}")
    public ResponseEntity<Map<String, Object>> pollZhihuQrcode(@PathVariable String qrcodeKey) {
        ZhihuQrSession session = ZHIHU_QR_SESSIONS.get(qrcodeKey);
        if (session == null) {
            return buildErrorResponse("二维码会话已过期，请重新获取");
        }

        try {
            long t0 = System.currentTimeMillis();
            String scanUrl = "https://www.zhihu.com/api/v3/account/api/login/qrcode/" + qrcodeKey + "/scan_info";
            String cookieStr = extractCookies(session.cookieManager);
            System.out.println("[ZhihuPoll] polling key=" + qrcodeKey.substring(0, Math.min(8, qrcodeKey.length())) + "... cookies_len=" + cookieStr.length());

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(scanUrl))
                    .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
                    .header("Referer", "https://www.zhihu.com/signin")
                    .header("x-requested-with", "fetch")
                    .header("Cookie", cookieStr)
                    .timeout(Duration.ofSeconds(10))
                    .GET()
                    .build();

            HttpResponse<String> response = (HttpResponse<String>) session.httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            long elapsed = System.currentTimeMillis() - t0;
            String respBody = response.body();
            System.out.println("[ZhihuPoll] HTTP " + response.statusCode() + " in " + elapsed + "ms, body: " + (respBody != null ? respBody.substring(0, Math.min(300, respBody.length())) : "null"));

            Map<String, Object> body = parseJson(respBody);

            if (body == null) {
                System.out.println("[ZhihuPoll] parseJson returned null");
                return buildErrorResponse("轮询返回数据异常");
            }

            Object statusObj = body.get("status");
            int scanStatus = -1;
            if (statusObj instanceof Integer) {
                scanStatus = (Integer) statusObj;
            } else if (statusObj instanceof String) {
                try {
                    scanStatus = Integer.parseInt((String) statusObj);
                } catch (NumberFormatException ignored) {
                }
            }
            System.out.println("[ZhihuPoll] scanStatus=" + scanStatus + " hasError=" + body.containsKey("error") + " hasErrorCode=" + body.containsKey("error_code"));

            int status;
            String message;
            boolean success = false;

            switch (scanStatus) {
                case 0:
                    status = -1;
                    message = "请使用知乎 App 扫描二维码";
                    break;
                case 1:
                    status = 0;
                    message = "已扫描，请在手机上确认登录";
                    break;
                case 2:
                    // 知乎 scan_info 返回 status=2 表示登录成功
                    status = 1;
                    message = "登录成功";
                    success = true;
                    String savedCookie = extractCookies(session.cookieManager);
                    System.out.println("[ZhihuPoll] login success, saving cookie len=" + savedCookie.length());
                    saveZhihuCredential(savedCookie);
                    ZHIHU_QR_SESSIONS.remove(qrcodeKey);
                    break;
                default:
                    // 其他 status 值（如 3=过期, 5=取消）或错误响应
                    System.out.println("[ZhihuPoll] unexpected scanStatus=" + scanStatus + ", treating as expired/error");
                    status = 2;
                    message = "二维码已过期或失效，请重试";
                    ZHIHU_QR_SESSIONS.remove(qrcodeKey);
                    break;
            }

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("status", status);
            result.put("message", message);
            result.put("success", success);
            return ResponseEntity.ok(result);

        } catch (Exception e) {
            return buildErrorResponse("轮询知乎登录状态失败: " + e.getMessage());
        }
    }

    private void saveZhihuCredential(String cookieStr) {
        Long userId = getCurrentUserId();
        userPlatformRepository.findByUserIdAndPlatform(userId, "ZHIHU")
                .ifPresent(userPlatformRepository::delete);

        UserPlatform userPlatform = new UserPlatform();
        userPlatform.setUserId(userId);
        userPlatform.setPlatform("ZHIHU");
        userPlatform.setCredential(cookieStr);
        userPlatformRepository.save(userPlatform);
    }

    private void cleanExpiredZhihuSessions() {
        Instant now = Instant.now();
        ZHIHU_QR_SESSIONS.entrySet().removeIf(entry ->
                Duration.between(entry.getValue().createdAt, now).compareTo(ZHIHU_QR_SESSION_TTL) > 0);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> parseJson(String json) {
        try {
            return new com.fasterxml.jackson.databind.ObjectMapper().readValue(json, LinkedHashMap.class);
        } catch (Exception e) {
            return null;
        }
    }

    private ResponseEntity<Map<String, Object>> buildErrorResponse(String message) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("error", message);
        return ResponseEntity.status(502).body(result);
    }

    private Long getCurrentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        String username = authentication.getName();
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));
        return user.getId();
    }
}
