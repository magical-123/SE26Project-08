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

    // 查询用户在指定时间之后的已分析视频
    List<InformationItem> findByUserIdAndProcessStatusAndAnalyzedAtAfter(
            Long userId, String processStatus, LocalDateTime afterTime);

    // 查询用户在指定时间范围内的已分析视频（使用crawledAt）
    List<InformationItem> findByUserIdAndProcessStatusAndCrawledAtBetween(
            Long userId, String processStatus, LocalDateTime startTime, LocalDateTime endTime);

    long countByUserIdAndPlatform(Long userId, String platform);
    List<InformationItem> findByAiSummaryIsNull(Pageable pageable);
    List<InformationItem> findByProcessStatusAndAiSummaryIsNullAndUserIdIn(
            String processStatus, java.util.Collection<Long> userIds, Pageable pageable);

    // 查询 UNPROCESSED 条目，优先处理缺少 AI 摘要的（按 id 升序，旧数据优先）
    List<InformationItem> findByProcessStatusAndUserIdInOrderByAiSummaryAscIdAsc(
            String processStatus, java.util.Collection<Long> userIds, Pageable pageable);
    // 查询 AI 摘要为空的条目（不论状态），按 id 升序
    @Query("SELECT i FROM InformationItem i WHERE i.processStatus IN :statuses AND i.userId IN :userIds AND (i.aiSummary IS NULL OR i.aiSummary = '') ORDER BY i.id ASC")
    List<InformationItem> findWithoutSummaryByStatusesAndUserIdOrderByIdAsc(
            @Param("statuses") java.util.Collection<String> statuses,
            @Param("userIds") java.util.Collection<Long> userIds,
            Pageable pageable);

    // 查询 AI 摘要为空的条目，非娱乐内容优先（娱乐短剧/娱乐科普排后面）
    @Query("SELECT i FROM InformationItem i WHERE i.processStatus IN :statuses AND i.userId IN :userIds AND (i.aiSummary IS NULL OR i.aiSummary = '') " +
            "ORDER BY CASE WHEN i.category IN ('娱乐短剧', '娱乐科普') THEN 1 ELSE 0 END ASC, i.id ASC")
    List<InformationItem> findWithoutSummaryPriorityNonEntertainment(
            @Param("statuses") java.util.Collection<String> statuses,
            @Param("userIds") java.util.Collection<Long> userIds,
            Pageable pageable);

    // 按标题+平台+用户查找最新的一条（用于去重）
    Optional<InformationItem> findTopByUserIdAndTitleAndPlatformOrderByCrawledAtDesc(Long userId, String title, String platform);

    // 局部更新：仅更新营养分析相关字段，不影响 aiSummary 等由 AI 摘要服务维护的字段
    @Modifying
    @Query("UPDATE InformationItem i SET " +
            "i.nutritionProtein = COALESCE(:protein, i.nutritionProtein), " +
            "i.nutritionCarbs = COALESCE(:carbs, i.nutritionCarbs), " +
            "i.nutritionVitamins = COALESCE(:vitamins, i.nutritionVitamins), " +
            "i.nutritionFats = COALESCE(:fats, i.nutritionFats), " +
            "i.nutritionFiber = COALESCE(:fiber, i.nutritionFiber), " +
            "i.nutritionReasoning = COALESCE(:reasoning, i.nutritionReasoning), " +
            "i.processStatus = 'PROCESSED', " +
            "i.analyzedAt = :analyzedAt " +
            "WHERE i.id = :id")
    void updateAnalysisFields(@Param("id") Long id,
                              @Param("protein") Integer protein,
                              @Param("carbs") Integer carbs,
                              @Param("vitamins") Integer vitamins,
                              @Param("fats") Integer fats,
                              @Param("fiber") Integer fiber,
                              @Param("reasoning") String reasoning,
                              @Param("analyzedAt") LocalDateTime analyzedAt);

    // 局部更新：仅更新 AI 摘要相关字段（null 值不覆盖数据库现有值）
    @Modifying
    @Query("UPDATE InformationItem i SET " +
            "i.aiSummary = CASE WHEN :summary IS NULL THEN i.aiSummary ELSE :summary END, " +
            "i.knowledgeScore = CASE WHEN :score IS NULL THEN i.knowledgeScore ELSE :score END, " +
            "i.scoreReasoning = CASE WHEN :reasoning IS NULL THEN i.scoreReasoning ELSE :reasoning END, " +
            "i.category = CASE WHEN :category IS NULL THEN i.category ELSE :category END, " +
            "i.processStatus = 'PROCESSED', " +
            "i.analyzedAt = :analyzedAt " +
            "WHERE i.id = :id")
    void updateAiSummaryFields(@Param("id") Long id,
                               @Param("summary") String summary,
                               @Param("score") Integer score,
                               @Param("reasoning") String reasoning,
                               @Param("category") String category,
                               @Param("analyzedAt") LocalDateTime analyzedAt);

    // 局部更新：仅更新 processStatus
    @Modifying
    @Query("UPDATE InformationItem i SET i.processStatus = :status WHERE i.id = :id")
    void updateProcessStatus(@Param("id") Long id, @Param("status") String status);

    // 切换点赞状态
    @Modifying
    @Query("UPDATE InformationItem i SET i.isLiked = :liked WHERE i.id = :id")
    void updateIsLiked(@Param("id") Long id, @Param("liked") Boolean liked);

    // 切换收藏状态
    @Modifying
    @Query("UPDATE InformationItem i SET i.isFavorite = :favorite WHERE i.id = :id")
    void updateIsFavorite(@Param("id") Long id, @Param("favorite") Boolean favorite);
}
