package com.infodigest.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
public class PingController {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @GetMapping("/api/ping")
    public Map<String, Object> ping() {
        return Map.of("success", true, "timestamp", System.currentTimeMillis());
    }

    /**
     * 数据库健康检查：执行 SELECT 1，验证数据库连通性。
     * 数据库连接故障由统一异常处理返回 503，其他数据访问异常返回 500。
     */
    @GetMapping("/api/health/db")
    public Map<String, Object> dbHealth() {
        jdbcTemplate.queryForObject("SELECT 1", Integer.class);
        return Map.of(
            "status", "UP",
            "database", "connected",
            "timestamp", System.currentTimeMillis()
        );
    }
}
