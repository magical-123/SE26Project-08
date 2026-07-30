package com.infodigest.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.sql.SQLException;
import java.time.Instant;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(DataAccessResourceFailureException.class)
    public ResponseEntity<Map<String, Object>> handleDataAccessResourceFailure(DataAccessResourceFailureException ex) {
        log.error("数据库连接失败: {}", ex.getMessage());
        return buildError(HttpStatus.SERVICE_UNAVAILABLE, "数据库服务暂时不可用，请稍后重试");
    }

    @ExceptionHandler(DataAccessException.class)
    public ResponseEntity<Map<String, Object>> handleDataAccessException(DataAccessException ex) {
        log.error("数据访问异常: {}", ex.getMessage());
        return buildError(HttpStatus.INTERNAL_SERVER_ERROR, "数据服务异常，请稍后重试");
    }

    @ExceptionHandler(SQLException.class)
    public ResponseEntity<Map<String, Object>> handleSQLException(SQLException ex) {
        log.error("SQL异常: {}", ex.getMessage());
        return buildError(HttpStatus.INTERNAL_SERVER_ERROR, "数据库服务异常");
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleGenericException(Exception ex) {
        log.error("未捕获异常: {} - {}", ex.getClass().getSimpleName(), ex.getMessage());
        return buildError(HttpStatus.INTERNAL_SERVER_ERROR, "服务器内部错误");
    }

    private ResponseEntity<Map<String, Object>> buildError(HttpStatus status, String message) {
        return ResponseEntity.status(status).body(Map.of(
                "success", false,
                "error", message,
                "timestamp", Instant.now().toString()
        ));
    }
}
