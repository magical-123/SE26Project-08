package com.infodigest.security;

import com.infodigest.entity.User;
import com.infodigest.repository.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.LocalDateTime;

/**
 * 在每个认证请求中更新用户的 lastActiveAt 时间。
 * 只在关键路径（非静态资源）上执行写入，避免频繁写库。
 */
@Component
@RequiredArgsConstructor
public class UserActivityFilter extends OncePerRequestFilter {

    private final UserRepository userRepository;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        // 只处理 API 请求
        String path = request.getRequestURI();
        if (path.startsWith("/api/")) {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getPrincipal())) {
                String username = auth.getName();
                // 每 2 分钟最多更新一次，避免频繁写库
                userRepository.findByUsername(username).ifPresent(user -> {
                    LocalDateTime now = LocalDateTime.now();
                    if (user.getLastActiveAt() == null || user.getLastActiveAt().isBefore(now.minusMinutes(2))) {
                        user.setLastActiveAt(now);
                        userRepository.save(user);
                    }
                });
            }
        }
        filterChain.doFilter(request, response);
    }
}
