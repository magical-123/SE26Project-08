package com.infodigest.repository;

import com.infodigest.entity.InformationItem;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
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

    // 局部更新：仅更新 AI 分析相关字段，不影响 isPremium 等用户手动标记的字段（null 值不覆盖数据库现有值）
    @Modifying
    @Query("UPDATE InformationItem i SET " +
            "i.nutritionProtein = COALESCE(:protein, i.nutritionProtein), " +
            "i.nutritionCarbs = COALESCE(:carbs, i.nutritionCarbs), " +
            "i.nutritionVitamins = COALESCE(:vitamins, i.nutritionVitamins), " +
            "i.nutritionFats = COALESCE(:fats, i.nutritionFats), " +
            "i.nutritionFiber = COALESCE(:fiber, i.nutritionFiber), " +
            "i.nutritionReasoning = COALESCE(:reasoning, i.nutritionReasoning), " +
            "i.aiSummary = COALESCE(:summary, i.aiSummary), " +
            "i.analyzedAt = :analyzedAt " +
            "WHERE i.id = :id")
    void updateAnalysisFields(@Param("id") Long id,
                              @Param("protein") Integer protein,
                              @Param("carbs") Integer carbs,
                              @Param("vitamins") Integer vitamins,
                              @Param("fats") Integer fats,
                              @Param("fiber") Integer fiber,
                              @Param("reasoning") String reasoning,
                              @Param("summary") String summary,
                              @Param("analyzedAt") LocalDateTime analyzedAt);

    // 局部更新：仅更新 AI 摘要相关字段（null 值不覆盖数据库现有值）
    @Modifying
    @Query("UPDATE InformationItem i SET " +
            "i.aiSummary = CASE WHEN :summary IS NULL THEN i.aiSummary ELSE :summary END, " +
            "i.knowledgeScore = CASE WHEN :score IS NULL THEN i.knowledgeScore ELSE :score END, " +
            "i.scoreReasoning = CASE WHEN :reasoning IS NULL THEN i.scoreReasoning ELSE :reasoning END, " +
            "i.analyzedAt = :analyzedAt " +
            "WHERE i.id = :id")
    void updateAiSummaryFields(@Param("id") Long id,
                               @Param("summary") String summary,
                               @Param("score") Integer score,
                               @Param("reasoning") String reasoning,
                               @Param("analyzedAt") LocalDateTime analyzedAt);

    // 局部更新：仅更新 processStatus
    @Modifying
    @Query("UPDATE InformationItem i SET i.processStatus = :status WHERE i.id = :id")
    void updateProcessStatus(@Param("id") Long id, @Param("status") String status);
}
