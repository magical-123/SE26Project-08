package com.infodigest.repository;

import com.infodigest.entity.InformationItem;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface InformationItemRepository extends JpaRepository<InformationItem, Long> {
    List<InformationItem> findByUserId(Long userId);
    Page<InformationItem> findByUserId(Long userId, Pageable pageable);
    List<InformationItem> findByUserIdAndProcessStatus(Long userId, String processStatus);
    List<InformationItem> findByProcessStatus(String processStatus, Pageable pageable);
    List<InformationItem> findByProcessStatusAndUserIdIn(String processStatus, java.util.Collection<Long> userIds, Pageable pageable);
    Optional<InformationItem> findByIdAndUserId(Long id, Long userId);

    // 查询用户在指定时间范围内的已分析视频
    List<InformationItem> findByUserIdAndProcessStatusAndAnalyzedAtBetween(
            Long userId, String processStatus, LocalDateTime startTime, LocalDateTime endTime);

    // 查询用户在指定时间范围内的已分析视频（使用crawledAt）
    List<InformationItem> findByUserIdAndProcessStatusAndCrawledAtBetween(
            Long userId, String processStatus, LocalDateTime startTime, LocalDateTime endTime);

    long countByUserIdAndPlatform(Long userId, String platform);
    List<InformationItem> findByAiSummaryIsNull(Pageable pageable);

    // 按标题+平台+用户查找最新的一条（用于去重）
    Optional<InformationItem> findTopByUserIdAndTitleAndPlatformOrderByCrawledAtDesc(Long userId, String title, String platform);
}
