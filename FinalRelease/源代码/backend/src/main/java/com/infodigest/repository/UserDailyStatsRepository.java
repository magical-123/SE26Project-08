package com.infodigest.repository;

import com.infodigest.entity.UserDailyStats;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface UserDailyStatsRepository extends JpaRepository<UserDailyStats, Long> {

    /**
     * 查找用户指定日期的统计数据
     */
    Optional<UserDailyStats> findByUserIdAndStatDate(Long userId, LocalDate statDate);

    /**
     * 查找用户指定日期之前的所有统计数据（用于累计计算）
     */
    List<UserDailyStats> findByUserIdAndStatDateBefore(Long userId, LocalDate beforeDate);

    /**
     * 查找用户所有历史统计数据
     */
    List<UserDailyStats> findByUserId(Long userId);

    /**
     * 查询用户历史累计数据（不包括今日）
     */
    @Query("SELECT " +
           "COALESCE(SUM(s.totalSeconds), 0.0) as totalSeconds, " +
           "COALESCE(SUM(s.proteinSeconds), 0.0) as proteinSeconds, " +
           "COALESCE(SUM(s.carbsSeconds), 0.0) as carbsSeconds, " +
           "COALESCE(SUM(s.vitaminsSeconds), 0.0) as vitaminsSeconds, " +
           "COALESCE(SUM(s.fatsSeconds), 0.0) as fatsSeconds, " +
           "COALESCE(SUM(s.fiberSeconds), 0.0) as fiberSeconds " +
           "FROM UserDailyStats s WHERE s.userId = :userId AND s.statDate < :today")
    Object[] getHistoricalSums(@Param("userId") Long userId, @Param("today") LocalDate today);
}
