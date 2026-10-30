package com.infodigest;

import com.infodigest.config.GlobalExceptionHandler;
import com.infodigest.config.SecurityConfig;
import com.infodigest.controller.PingController;
import com.infodigest.security.JwtAuthenticationFilter;
import com.infodigest.security.JwtUtil;
import com.infodigest.service.CustomUserDetailsService;
import com.zaxxer.hikari.HikariDataSource;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.autoconfigure.data.jpa.JpaRepositoriesAutoConfiguration;
import org.springframework.boot.autoconfigure.data.redis.RedisAutoConfiguration;
import org.springframework.boot.autoconfigure.data.redis.RedisRepositoriesAutoConfiguration;
import org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration;
import org.springframework.boot.test.autoconfigure.actuate.observability.AutoConfigureObservability;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Duration;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.mockito.Mockito.doThrow;

/**
 * Exercises the production HTTP/security/Actuator configuration against a real
 * servlet server and Hikari pool. H2 keeps verification independent of private
 * MySQL, Redis, crawlers, scheduled jobs and user data.
 * Observability is explicitly enabled because SpringBootTest otherwise disables
 * exporting meter registries, including the Prometheus registry under test.
 */
@AutoConfigureObservability
@SpringBootTest(
        classes = ObservabilityIntegrationTest.TestApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
                "spring.config.import=",
                "spring.datasource.url=jdbc:h2:mem:observability;DB_CLOSE_DELAY=-1",
                "spring.datasource.driver-class-name=org.h2.Driver",
                "spring.datasource.username=sa",
                "spring.datasource.password=",
                "spring.datasource.hikari.pool-name=observability-test",
                "DB_POOL_MAX_SIZE=3",
                "DB_POOL_MIN_IDLE=1"
        })
class ObservabilityIntegrationTest {

    @Configuration(proxyBeanMethods = false)
    @EnableAutoConfiguration(
            exclude = {
                    HibernateJpaAutoConfiguration.class,
                    JpaRepositoriesAutoConfiguration.class,
                    RedisAutoConfiguration.class,
                    RedisRepositoriesAutoConfiguration.class
            },
            excludeName = "org.redisson.spring.starter.RedissonAutoConfigurationV2")
    @Import({SecurityConfig.class, JwtAuthenticationFilter.class,
            PingController.class, GlobalExceptionHandler.class})
    static class TestApplication {
    }

    @Autowired
    private TestRestTemplate http;

    @Autowired
    private HikariDataSource dataSource;

    @SpyBean
    private JdbcTemplate jdbcTemplate;

    @MockBean
    private JwtUtil jwtUtil;

    @MockBean
    private CustomUserDetailsService userDetailsService;

    @Test
    void monitoringAndExistingPingRemainPublicWithoutExposingHealthDetails() {
        ResponseEntity<Map> health = http.getForEntity("/actuator/health", Map.class);
        assertThat(health.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(health.getBody()).containsEntry("status", "UP");
        assertThat(health.getBody()).doesNotContainKeys("components", "details");

        ResponseEntity<Map> ping = http.getForEntity("/api/ping", Map.class);
        assertThat(ping.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(ping.getBody()).containsEntry("success", true);

        ResponseEntity<String> metrics = http.getForEntity("/actuator/prometheus", String.class);
        assertThat(metrics.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(metrics.getHeaders().getContentType()).isNotNull();
        assertThat(metrics.getHeaders().getContentType().toString()).startsWith("text/plain");
        assertThat(metrics.getBody()).contains("# HELP", "application=\"infodigest-backend\"");
    }

    @Test
    void dbProbeProducesRedHistogramAndRealConnectionPoolMetrics() {
        assertThat(dataSource.getMaximumPoolSize()).isEqualTo(3);
        assertThat(dataSource.getMinimumIdle()).isEqualTo(1);

        ResponseEntity<Map> response = http.getForEntity("/api/health/db", Map.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).containsEntry("status", "UP")
                .containsEntry("database", "connected");

        Map<String, String> requestLabels = Map.of(
                "application", "infodigest-backend", "method", "GET",
                "uri", "/api/health/db", "status", "200");
        await().atMost(Duration.ofSeconds(5)).untilAsserted(() ->
                assertThat(sample(scrape(), "http_server_requests_seconds_count", requestLabels))
                        .isGreaterThanOrEqualTo(1));

        String metrics = scrape();
        double previousCount = sample(metrics, "http_server_requests_seconds_count", requestLabels);
        assertThat(sample(metrics, "http_server_requests_seconds_sum", requestLabels)).isPositive();
        List<String> buckets = samples(metrics, "http_server_requests_seconds_bucket", requestLabels);
        assertThat(buckets).hasSizeGreaterThan(1)
                .allSatisfy(line -> assertThat(line).contains("le=\""));

        Map<String, String> poolLabels = Map.of(
                "application", "infodigest-backend", "pool", "observability-test");
        assertThat(sample(metrics, "hikaricp_connections_active", poolLabels)).isZero();
        assertThat(sample(metrics, "hikaricp_connections_pending", poolLabels)).isZero();
        assertThat(sample(metrics, "hikaricp_connections_max", poolLabels)).isEqualTo(3);
        assertThat(sample(metrics, "hikaricp_connections_acquire_seconds_count", poolLabels))
                .isGreaterThanOrEqualTo(1);
        assertThat(sample(metrics, "hikaricp_connections_usage_seconds_count", poolLabels))
                .isGreaterThanOrEqualTo(1);

        assertThat(http.getForEntity("/api/health/db", Map.class).getStatusCode()).isEqualTo(HttpStatus.OK);
        await().atMost(Duration.ofSeconds(5)).untilAsserted(() ->
                assertThat(sample(scrape(), "http_server_requests_seconds_count", requestLabels))
                        .isEqualTo(previousCount + 1));
    }

    @Test
    void handledDatabaseFailureIsCountedAsServerError() {
        doThrow(new DataAccessResourceFailureException("test-only database unavailable"))
                .when(jdbcTemplate).queryForObject("SELECT 1", Integer.class);

        ResponseEntity<Map> response = http.getForEntity("/api/health/db", Map.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertThat(response.getBody()).containsEntry("success", false);

        Map<String, String> errorLabels = Map.of(
                "application", "infodigest-backend", "method", "GET",
                "uri", "/api/health/db", "status", "503");
        await().atMost(Duration.ofSeconds(5)).untilAsserted(() -> {
            String metrics = scrape();
            assertThat(sample(metrics, "http_server_requests_seconds_count", errorLabels)).isEqualTo(1);
            assertThat(samples(metrics, "http_server_requests_seconds_bucket", errorLabels)).isNotEmpty();
        });
    }

    @Test
    void businessAndOtherManagementPathsStillRequireAuthentication() {
        for (String path : List.of("/api/inbox", "/api/settings", "/actuator/env", "/actuator/metrics")) {
            assertThat(http.getForEntity(path, String.class).getStatusCode())
                    .as("anonymous access to %s", path)
                    .isEqualTo(HttpStatus.FORBIDDEN);
        }
    }

    private String scrape() {
        ResponseEntity<String> response = http.getForEntity("/actuator/prometheus", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        return response.getBody();
    }

    private static List<String> samples(String metrics, String name, Map<String, String> labels) {
        return metrics.lines()
                .filter(line -> line.startsWith(name + "{"))
                .filter(line -> labels.entrySet().stream()
                        .allMatch(label -> line.contains(label.getKey() + "=\"" + label.getValue() + "\"")))
                .toList();
    }

    private static double sample(String metrics, String name, Map<String, String> labels) {
        List<String> matching = samples(metrics, name, labels);
        assertThat(matching).as("metric %s with labels %s", name, labels).hasSize(1);
        String line = matching.get(0);
        return Double.parseDouble(line.substring(line.indexOf("} ") + 2).split(" ")[0]);
    }
}
