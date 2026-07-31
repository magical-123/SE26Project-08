package com.infodigest.config;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.sql.SQLException;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new DummyController())
                .setControllerAdvice(handler)
                .build();
    }

    // ========== 直接调用 handler 的单元测试 ==========

    @Test
    void handleDataAccessResourceFailure_returns503WithErrorMessage() {
        DataAccessResourceFailureException ex = new DataAccessResourceFailureException("Connection refused");

        ResponseEntity<Map<String, Object>> response = handler.handleDataAccessResourceFailure(ex);

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, response.getStatusCode());
        assertFalse((Boolean) response.getBody().get("success"));
        assertEquals("数据库服务暂时不可用，请稍后重试", response.getBody().get("error"));
        assertNotNull(response.getBody().get("timestamp"));
    }

    @Test
    void handleDataAccessException_returns500WithErrorMessage() {
        DataAccessException ex = new DataAccessException("Query failed") {};

        ResponseEntity<Map<String, Object>> response = handler.handleDataAccessException(ex);

        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, response.getStatusCode());
        assertFalse((Boolean) response.getBody().get("success"));
        assertEquals("数据服务异常，请稍后重试", response.getBody().get("error"));
        assertNotNull(response.getBody().get("timestamp"));
    }

    @Test
    void handleSQLException_returns500WithErrorMessage() {
        SQLException ex = new SQLException("Syntax error");

        ResponseEntity<Map<String, Object>> response = handler.handleSQLException(ex);

        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, response.getStatusCode());
        assertFalse((Boolean) response.getBody().get("success"));
        assertEquals("数据库服务异常", response.getBody().get("error"));
        assertNotNull(response.getBody().get("timestamp"));
    }

    @Test
    void handleGenericException_returns500WithErrorMessage() {
        RuntimeException ex = new RuntimeException("Unexpected error");

        ResponseEntity<Map<String, Object>> response = handler.handleGenericException(ex);

        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, response.getStatusCode());
        assertFalse((Boolean) response.getBody().get("success"));
        assertEquals("服务器内部错误", response.getBody().get("error"));
        assertNotNull(response.getBody().get("timestamp"));
    }

    @Test
    void handleDataAccessResourceFailure_withRootCause_returns503() {
        Throwable rootCause = new RuntimeException("Connection pool exhausted");
        DataAccessResourceFailureException ex = new DataAccessResourceFailureException("Cannot acquire connection", rootCause);

        ResponseEntity<Map<String, Object>> response = handler.handleDataAccessResourceFailure(ex);

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, response.getStatusCode());
        assertFalse((Boolean) response.getBody().get("success"));
        assertEquals("数据库服务暂时不可用，请稍后重试", response.getBody().get("error"));
        assertNotNull(response.getBody().get("timestamp"));
    }

    @Test
    void handleSQLException_withSQLState_returns500() {
        SQLException ex = new SQLException("Deadlock detected", "40001", 1205);

        ResponseEntity<Map<String, Object>> response = handler.handleSQLException(ex);

        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, response.getStatusCode());
        assertFalse((Boolean) response.getBody().get("success"));
        assertEquals("数据库服务异常", response.getBody().get("error"));
        assertNotNull(response.getBody().get("timestamp"));
    }

    // ========== 通过 MockMvc 触发 @RestControllerAdvice 的集成测试 ==========

    @Test
    void dataAccessResourceFailure_throughMockMvc_returns503() throws Exception {
        mockMvc.perform(get("/test/data-access-resource-failure"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error").value("数据库服务暂时不可用，请稍后重试"))
                .andExpect(jsonPath("$.timestamp").isNotEmpty());
    }

    @Test
    void dataAccessException_throughMockMvc_returns500() throws Exception {
        mockMvc.perform(get("/test/data-access-exception"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error").value("数据服务异常，请稍后重试"))
                .andExpect(jsonPath("$.timestamp").isNotEmpty());
    }

    @Test
    void sqlException_throughMockMvc_returns500() throws Exception {
        mockMvc.perform(get("/test/sql-exception"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error").value("数据库服务异常"))
                .andExpect(jsonPath("$.timestamp").isNotEmpty());
    }

    @Test
    void genericException_throughMockMvc_returns500() throws Exception {
        mockMvc.perform(get("/test/generic-exception"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error").value("服务器内部错误"))
                .andExpect(jsonPath("$.timestamp").isNotEmpty());
    }

    /**
     * 模拟控制器，用于通过 MockMvc 触发异常处理器。
     */
    @RestController
    static class DummyController {

        @GetMapping("/test/data-access-resource-failure")
        public void throwDataAccessResourceFailure() {
            throw new DataAccessResourceFailureException("Connection refused");
        }

        @GetMapping("/test/data-access-exception")
        public void throwDataAccessException() {
            throw new DataAccessException("Query failed") {};
        }

        @GetMapping("/test/sql-exception")
        public void throwSQLException() throws SQLException {
            throw new SQLException("Syntax error");
        }

        @GetMapping("/test/generic-exception")
        public void throwGenericException() {
            throw new RuntimeException("Unexpected error");
        }
    }
}
