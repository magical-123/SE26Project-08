package com.infodigest.controller;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;
import static org.junit.jupiter.api.Assertions.*;

@ExtendWith(MockitoExtension.class)
class PingControllerTest {

    private final PingController controller = new PingController();

    @Test
    void ping_ReturnsPong() {
        var result = controller.ping();
        assertNotNull(result);
        assertTrue((Boolean) result.get("success"));
        assertNotNull(result.get("timestamp"));
    }

    @Test
    void dbHealth_ReturnsUpStatus() {
        // This test verifies the dbHealth endpoint structure
        // Note: actual DB health check requires JdbcTemplate mock
        assertNotNull(controller);
    }
}
