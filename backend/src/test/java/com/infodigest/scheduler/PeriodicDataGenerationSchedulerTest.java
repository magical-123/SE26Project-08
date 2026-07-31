package com.infodigest.scheduler;

import com.infodigest.entity.User;
import com.infodigest.repository.UserRepository;
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
class PeriodicDataGenerationSchedulerTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private WordCloudService wordCloudService;

    @Mock
    private TopicClusterService topicClusterService;

    @InjectMocks
    private PeriodicDataGenerationScheduler periodicDataGenerationScheduler;

    private User createUser(Long id, String username) {
        User user = new User();
        user.setId(id);
        user.setUsername(username);
        return user;
    }

    @Test
    void generatePeriodicData_generatesWordcloudAndClustersForAllUsers() throws Exception {
        // Given
        User user1 = createUser(1L, "alice");
        User user2 = createUser(2L, "bob");
        when(userRepository.findAll()).thenReturn(List.of(user1, user2));

        // When
        periodicDataGenerationScheduler.generatePeriodicData();

        // Then
        verify(wordCloudService, times(2)).generateWordCloud(anyLong(), any(LocalDate.class));
        verify(topicClusterService, times(2)).generateDailyTopicClusters(anyLong(), any(LocalDate.class));
        verify(topicClusterService, times(2)).generateWeeklyTopicClusters(anyLong(), any(LocalDate.class));
    }

    @Test
    void generatePeriodicData_handlesPerUserFailures() throws Exception {
        // Given
        User user1 = createUser(1L, "alice");
        User user2 = createUser(2L, "bob");
        when(userRepository.findAll()).thenReturn(List.of(user1, user2));

        // First user fails for all three operations
        doThrow(new RuntimeException("WordCloud failed"))
                .when(wordCloudService).generateWordCloud(eq(1L), any(LocalDate.class));
        doThrow(new RuntimeException("Daily topic failed"))
                .when(topicClusterService).generateDailyTopicClusters(eq(1L), any(LocalDate.class));
        doThrow(new RuntimeException("Weekly topic failed"))
                .when(topicClusterService).generateWeeklyTopicClusters(eq(1L), any(LocalDate.class));

        // When
        periodicDataGenerationScheduler.generatePeriodicData();

        // Then - second user still processed successfully
        verify(wordCloudService).generateWordCloud(1L, LocalDate.now());
        verify(wordCloudService).generateWordCloud(2L, LocalDate.now());
        verify(topicClusterService).generateDailyTopicClusters(1L, LocalDate.now());
        verify(topicClusterService).generateDailyTopicClusters(2L, LocalDate.now());
        verify(topicClusterService).generateWeeklyTopicClusters(1L, LocalDate.now());
        verify(topicClusterService).generateWeeklyTopicClusters(2L, LocalDate.now());
    }

    @Test
    void generatePeriodicData_handlesOuterException() {
        // Given - userRepository.findAll throws to exercise outer catch
        when(userRepository.findAll()).thenThrow(new RuntimeException("DB error"));

        // When - should not propagate exception
        periodicDataGenerationScheduler.generatePeriodicData();

        // Then
        verify(userRepository).findAll();
    }
}
