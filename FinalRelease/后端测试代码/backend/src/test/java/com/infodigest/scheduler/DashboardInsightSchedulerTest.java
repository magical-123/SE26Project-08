package com.infodigest.scheduler;

import com.infodigest.entity.User;
import com.infodigest.repository.UserRepository;
import com.infodigest.service.DashboardInsightService;
import com.infodigest.service.ReviewCardGenerationService;
import com.infodigest.service.WordCloudService;
import com.infodigest.service.TopicClusterService;
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
class DashboardInsightSchedulerTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private DashboardInsightService dashboardInsightService;

    @Mock
    private ReviewCardGenerationService reviewCardGenerationService;

    @Mock
    private WordCloudService wordCloudService;

    @Mock
    private TopicClusterService topicClusterService;

    @InjectMocks
    private DashboardInsightScheduler dashboardInsightScheduler;

    private User createUser(Long id, String username) {
        User user = new User();
        user.setId(id);
        user.setUsername(username);
        return user;
    }

    @Test
    void generateDailyData_processesAllUsersSuccessfully() throws Exception {
        // Given
        User user1 = createUser(1L, "alice");
        User user2 = createUser(2L, "bob");
        when(userRepository.findAll()).thenReturn(List.of(user1, user2));

        // When
        dashboardInsightScheduler.generateDailyData();

        // Then
        verify(dashboardInsightService).generateDashboardInsight(1L);
        verify(dashboardInsightService).generateDashboardInsight(2L);
        verify(reviewCardGenerationService, times(2)).generateTodayReviewCard(anyLong());
        verify(wordCloudService, times(2)).generateWordCloud(anyLong(), any(LocalDate.class));
        verify(topicClusterService, times(2)).generateDailyTopicClusters(anyLong(), any(LocalDate.class));
    }

    @Test
    void generateDailyData_handlesPerUserFailures() throws Exception {
        // Given
        User user1 = createUser(1L, "alice");
        User user2 = createUser(2L, "bob");
        when(userRepository.findAll()).thenReturn(List.of(user1, user2));

        // First user's insight fails, but the rest still proceed
        doThrow(new RuntimeException("Insight generation failed"))
                .when(dashboardInsightService).generateDashboardInsight(1L);
        doThrow(new RuntimeException("Review card failed"))
                .when(reviewCardGenerationService).generateTodayReviewCard(1L);
        doThrow(new RuntimeException("Word cloud failed"))
                .when(wordCloudService).generateWordCloud(eq(1L), any(LocalDate.class));
        doThrow(new RuntimeException("Topic cluster failed"))
                .when(topicClusterService).generateDailyTopicClusters(eq(1L), any(LocalDate.class));

        // When
        dashboardInsightScheduler.generateDailyData();

        // Then - second user still processed successfully
        verify(dashboardInsightService).generateDashboardInsight(1L);
        verify(dashboardInsightService).generateDashboardInsight(2L);
        verify(reviewCardGenerationService).generateTodayReviewCard(1L);
        verify(reviewCardGenerationService).generateTodayReviewCard(2L);
        verify(wordCloudService).generateWordCloud(eq(1L), any(LocalDate.class));
        verify(wordCloudService).generateWordCloud(eq(2L), any(LocalDate.class));
        verify(topicClusterService).generateDailyTopicClusters(eq(1L), any(LocalDate.class));
        verify(topicClusterService).generateDailyTopicClusters(eq(2L), any(LocalDate.class));
    }

    @Test
    void generateReviewCardsEveryTwoHours_generatesForAllUsers() throws Exception {
        // Given
        User user1 = createUser(1L, "alice");
        User user2 = createUser(2L, "bob");
        when(userRepository.findAll()).thenReturn(List.of(user1, user2));

        // When
        dashboardInsightScheduler.generateReviewCardsEveryTwoHours();

        // Then
        verify(reviewCardGenerationService).generateTodayReviewCard(1L);
        verify(reviewCardGenerationService).generateTodayReviewCard(2L);
    }

    @Test
    void generateDailyData_handlesOuterException() {
        // Given - userRepository.findAll throws to exercise outer catch
        when(userRepository.findAll()).thenThrow(new RuntimeException("DB error"));

        // When - should not propagate exception
        dashboardInsightScheduler.generateDailyData();

        // Then
        verify(userRepository).findAll();
    }

    @Test
    void generateReviewCardsEveryTwoHours_handlesPerUserFailure() throws Exception {
        // Given
        User user = createUser(1L, "alice");
        when(userRepository.findAll()).thenReturn(List.of(user));
        doThrow(new RuntimeException("Review card failed")).when(reviewCardGenerationService).generateTodayReviewCard(1L);

        // When
        dashboardInsightScheduler.generateReviewCardsEveryTwoHours();

        // Then - per-user failure is caught, no crash
        verify(reviewCardGenerationService).generateTodayReviewCard(1L);
    }

    @Test
    void generateReviewCardsEveryTwoHours_handlesOuterException() {
        // Given - userRepository.findAll throws to exercise outer catch
        when(userRepository.findAll()).thenThrow(new RuntimeException("DB error"));

        // When - should not propagate exception
        dashboardInsightScheduler.generateReviewCardsEveryTwoHours();

        // Then
        verify(userRepository).findAll();
    }
}
