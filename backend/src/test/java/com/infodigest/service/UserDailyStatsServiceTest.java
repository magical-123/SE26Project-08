package com.infodigest.service;

import com.infodigest.entity.InformationItem;
import com.infodigest.entity.UserDailyStats;
import com.infodigest.repository.InformationItemRepository;
import com.infodigest.repository.UserDailyStatsRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserDailyStatsServiceTest {

    @Mock
    private UserDailyStatsRepository statsRepository;

    @Mock
    private InformationItemRepository itemRepository;

    @InjectMocks
    private UserDailyStatsService userDailyStatsService;

    @Captor
    private ArgumentCaptor<UserDailyStats> statsCaptor;

    @Captor
    private ArgumentCaptor<InformationItem> itemCaptor;

    @Test
    void getHistoricalStats_returnsAccumulatedStats() {
        // Given
        Long userId = 1L;
        LocalDate today = LocalDate.now();

        Object[] sums = new Object[]{3600.0, 1800.0, 900.0, 450.0, 300.0, 150.0};
        when(statsRepository.getHistoricalSums(userId, today)).thenReturn(sums);

        // When
        UserDailyStatsService.HistoricalStats result = userDailyStatsService.getHistoricalStats(userId, today);

        // Then
        assertThat(result.totalSeconds).isEqualTo(3600.0);
        assertThat(result.proteinSeconds).isEqualTo(1800.0);
        assertThat(result.carbsSeconds).isEqualTo(900.0);
        assertThat(result.vitaminsSeconds).isEqualTo(450.0);
        assertThat(result.fatsSeconds).isEqualTo(300.0);
        assertThat(result.fiberSeconds).isEqualTo(150.0);
    }

    @Test
    void getHistoricalStats_handlesNestedArrayResult() {
        // Given
        Long userId = 1L;
        LocalDate today = LocalDate.now();

        Object[] inner = new Object[]{7200.0, 3600.0, 1800.0, 900.0, 600.0, 300.0};
        Object[] sums = new Object[]{inner};
        when(statsRepository.getHistoricalSums(userId, today)).thenReturn(sums);

        // When
        UserDailyStatsService.HistoricalStats result = userDailyStatsService.getHistoricalStats(userId, today);

        // Then
        assertThat(result.totalSeconds).isEqualTo(7200.0);
        assertThat(result.proteinSeconds).isEqualTo(3600.0);
    }

    @Test
    void getHistoricalStats_handlesEmptyDatabase() {
        // Given
        Long userId = 1L;
        LocalDate today = LocalDate.now();

        when(statsRepository.getHistoricalSums(userId, today)).thenReturn(null);

        // When
        UserDailyStatsService.HistoricalStats result = userDailyStatsService.getHistoricalStats(userId, today);

        // Then
        assertThat(result.totalSeconds).isEqualTo(0.0);
        assertThat(result.proteinSeconds).isEqualTo(0.0);
        assertThat(result.carbsSeconds).isEqualTo(0.0);
    }

    @Test
    void updateDailyStats_updatesExistingDate() {
        // Given
        Long userId = 1L;
        InformationItem item = new InformationItem();
        item.setId(100L);
        item.setUserId(userId);
        item.setTitle("测试视频");
        item.setCrawledAt(LocalDateTime.now());
        item.setWatchDurationSeconds(120);
        item.setNutritionProtein(50);
        item.setNutritionCarbs(30);
        item.setNutritionVitamins(10);
        item.setNutritionFats(5);
        item.setNutritionFiber(5);

        LocalDate itemDate = LocalDate.now();
        UserDailyStats existingStats = new UserDailyStats();
        existingStats.setId(1L);
        existingStats.setUserId(userId);
        existingStats.setStatDate(itemDate);
        existingStats.setTotalSeconds(100.0);
        existingStats.setProteinSeconds(50.0);
        existingStats.setCarbsSeconds(30.0);
        existingStats.setVitaminsSeconds(10.0);
        existingStats.setFatsSeconds(5.0);
        existingStats.setFiberSeconds(5.0);
        existingStats.setAnalyzedCount(1);

        when(statsRepository.findByUserIdAndStatDate(userId, itemDate))
                .thenReturn(Optional.of(existingStats));

        // When
        userDailyStatsService.updateDailyStats(userId, item);

        // Then
        verify(statsRepository).save(statsCaptor.capture());
        UserDailyStats saved = statsCaptor.getValue();
        // 120s watch + existing 100s = 220s total
        assertThat(saved.getTotalSeconds()).isEqualTo(220.0);
        // protein: 50.0 + 120 * 0.5 = 50.0 + 60.0 = 110.0
        assertThat(saved.getProteinSeconds()).isEqualTo(110.0);
        // carbs: 30.0 + 120 * 0.3 = 30.0 + 36.0 = 66.0
        assertThat(saved.getCarbsSeconds()).isEqualTo(66.0);
        assertThat(saved.getAnalyzedCount()).isEqualTo(2);
    }

    @Test
    void updateDailyStats_createsNewStatsForNewDate() {
        // Given
        Long userId = 1L;
        InformationItem item = new InformationItem();
        item.setId(100L);
        item.setUserId(userId);
        item.setTitle("新视频");
        item.setCrawledAt(LocalDateTime.now());
        item.setWatchDurationSeconds(200);
        item.setNutritionProtein(40);
        item.setNutritionCarbs(35);
        item.setNutritionVitamins(15);
        item.setNutritionFats(5);
        item.setNutritionFiber(5);

        LocalDate itemDate = LocalDate.now();

        when(statsRepository.findByUserIdAndStatDate(userId, itemDate))
                .thenReturn(Optional.empty());

        // When
        userDailyStatsService.updateDailyStats(userId, item);

        // Then
        verify(statsRepository).save(statsCaptor.capture());
        UserDailyStats saved = statsCaptor.getValue();
        assertThat(saved.getUserId()).isEqualTo(userId);
        assertThat(saved.getStatDate()).isEqualTo(itemDate);
        assertThat(saved.getTotalSeconds()).isEqualTo(200.0);
        // protein: 200 * 0.4 = 80
        assertThat(saved.getProteinSeconds()).isEqualTo(80.0);
        // carbs: 200 * 0.35 = 70
        assertThat(saved.getCarbsSeconds()).isEqualTo(70.0);
        assertThat(saved.getAnalyzedCount()).isEqualTo(1);
    }

    @Test
    void updateDailyStats_skipsWhenCrawledAtIsNull() {
        // Given
        Long userId = 1L;
        InformationItem item = new InformationItem();
        item.setId(100L);
        item.setUserId(userId);
        item.setCrawledAt(null);

        // When
        userDailyStatsService.updateDailyStats(userId, item);

        // Then
        verify(statsRepository, never()).findByUserIdAndStatDate(anyLong(), any());
        verify(statsRepository, never()).save(any());
    }

    @Test
    void updateDailyStats_handlesNullNutritionValues() {
        // Given
        Long userId = 1L;
        InformationItem item = new InformationItem();
        item.setId(100L);
        item.setUserId(userId);
        item.setTitle("无营养数据");
        item.setCrawledAt(LocalDateTime.now());
        item.setWatchDurationSeconds(100);
        // No nutrition values set

        LocalDate itemDate = LocalDate.now();

        when(statsRepository.findByUserIdAndStatDate(userId, itemDate))
                .thenReturn(Optional.empty());

        // When
        userDailyStatsService.updateDailyStats(userId, item);

        // Then
        verify(statsRepository).save(statsCaptor.capture());
        UserDailyStats saved = statsCaptor.getValue();
        assertThat(saved.getTotalSeconds()).isEqualTo(100.0);
        assertThat(saved.getProteinSeconds()).isEqualTo(0.0);
        assertThat(saved.getCarbsSeconds()).isEqualTo(0.0);
        assertThat(saved.getAnalyzedCount()).isEqualTo(1);
    }
}
