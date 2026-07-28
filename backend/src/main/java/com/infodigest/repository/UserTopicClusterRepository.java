package com.infodigest.repository;

import com.infodigest.entity.UserTopicCluster;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.Optional;

@Repository
public interface UserTopicClusterRepository extends JpaRepository<UserTopicCluster, Long> {

    /**
     * 查询指定用户指定日期的话题聚类（已废弃，请使用带 reportType 的方法）
     * @deprecated 使用 findByUserIdAndReportDateAndReportType 代替
     */
    @Deprecated
    Optional<UserTopicCluster> findByUserIdAndReportDate(Long userId, LocalDate reportDate);

    /**
     * 查询指定用户、指定日期、指定类型的话题聚类
     */
    Optional<UserTopicCluster> findByUserIdAndReportDateAndReportType(Long userId, LocalDate reportDate, String reportType);
}
