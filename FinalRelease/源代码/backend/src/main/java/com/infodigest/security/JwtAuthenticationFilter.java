package com.infodigest.security;

import com.infodigest.service.CustomUserDetailsService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
@RequiredArgsConstructor
@Slf4j
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;
    private final CustomUserDetailsService userDetailsService;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {

        final String authorizationHeader = request.getHeader("Authorization");
        log.debug("JWT Filter - Request URI: {}, Authorization present: {}", request.getRequestURI(), authorizationHeader != null);

        String username = null;
        String jwt = null;

        if (authorizationHeader != null && authorizationHeader.startsWith("Bearer ")) {
            jwt = authorizationHeader.substring(7);
            try {
                username = jwtUtil.extractUsername(jwt);
                log.debug("JWT Filter - Extracted username: {}", username);
            } catch (Exception e) {
                log.error("JWT Filter - Failed to extract username from token", e);
            }
        }

        if (username != null && SecurityContextHolder.getContext().getAuthentication() == null) {
            try {
                UserDetails userDetails = this.userDetailsService.loadUserByUsername(username);
                log.debug("JWT Filter - Loaded user details for: {}", username);

                if (jwtUtil.isTokenValid(jwt, userDetails.getUsername())) {
                    UsernamePasswordAuthenticationToken authenticationToken =
                            new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities());
                    authenticationToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authenticationToken);
                    log.debug("JWT Filter - Authentication set successfully for: {}", username);
                } else {
                    log.warn("JWT Filter - Token validation failed for: {}", username);
                }
            } catch (org.springframework.security.core.userdetails.UsernameNotFoundException e) {
                log.warn("JWT Filter - User not found: {}", username);
            } catch (Exception e) {
                log.error("JWT Filter - Authentication failed for user: {}", username, e);
                response.sendError(HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Database or server error during authentication");
                return;
            }
        } else {
            if (username == null) {
                log.debug("JWT Filter - No username extracted, skipping authentication");
            } else {
                log.debug("JWT Filter - Authentication already exists in context");
            }
        }
        chain.doFilter(request, response);
    }
}
