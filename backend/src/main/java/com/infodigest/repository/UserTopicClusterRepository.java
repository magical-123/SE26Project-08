package com.infodigest.repository;

import com.infodigest.entity.UserTopicCluster;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface UserTopicClusterRepository extends JpaRepository<UserTopicCluster, Long> {

    /**
     * 查询指定用户指定日期的话题聚类
     */
    Optional<UserTopicCluster> findFirstByUserIdAndReportDateOrderByCreatedAtDesc(Long userId, LocalDate reportDate);

    /**
     * 获取用户所有聚类报告，按日期倒序
     */
    List<UserTopicCluster> findByUserIdOrderByReportDateDesc(Long userId);
}
