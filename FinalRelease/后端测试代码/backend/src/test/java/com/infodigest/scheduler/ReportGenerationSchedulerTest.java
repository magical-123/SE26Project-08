package com.infodigest.scheduler;

import com.infodigest.entity.ReportType;
import com.infodigest.entity.User;
import com.infodigest.repository.UserRepository;
import com.infodigest.service.InsightService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ReportGenerationSchedulerTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private InsightService insightService;

    @InjectMocks
    private ReportGenerationScheduler reportGenerationScheduler;

    private User createUser(Long id) {
        User user = new User();
        user.setId(id);
        return user;
    }

    @Test
    void generateDailyReports_generatesDailyReportsForAllUsers() throws Exception {
        // Given
        User user1 = createUser(1L);
        User user2 = createUser(2L);
        when(userRepository.findAll()).thenReturn(List.of(user1, user2));

        // When
        reportGenerationScheduler.generateDailyReports();

        // Then
        verify(insightService).generateInsight(1L, ReportType.DAILY, LocalDate.now());
        verify(insightService).generateInsight(2L, ReportType.DAILY, LocalDate.now());
    }

    @Test
    void generateWeeklyReports_generatesWeeklyReportsForAllUsers() throws Exception {
        // Given
        User user1 = createUser(1L);
        User user2 = createUser(2L);
        when(userRepository.findAll()).thenReturn(List.of(user1, user2));

        // When
        reportGenerationScheduler.generateWeeklyReports();

        // Then
        verify(insightService).generateInsight(1L, ReportType.WEEKLY, LocalDate.now());
        verify(insightService).generateInsight(2L, ReportType.WEEKLY, LocalDate.now());
    }

    @Test
    void generateDailyReports_handlesPerUserFailures() throws Exception {
        // Given
        User user1 = createUser(1L);
        User user2 = createUser(2L);
        when(userRepository.findAll()).thenReturn(List.of(user1, user2));

        // First user fails, second user succeeds
        doThrow(new RuntimeException("No data for user"))
                .when(insightService).generateInsight(eq(1L), any(ReportType.class), any(LocalDate.class));

        // When
        reportGenerationScheduler.generateDailyReports();

        // Then - both users are attempted, no crash
        verify(insightService).generateInsight(1L, ReportType.DAILY, LocalDate.now());
        verify(insightService).generateInsight(2L, ReportType.DAILY, LocalDate.now());
    }
}
