package com.infodigest.repository;

import com.infodigest.entity.UserTopicCluster;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.Optional;

@Repository
public interface UserTopicClusterRepository extends JpaRepository<UserTopicCluster, Long> {

    /**
     * 查询指定用户指定日期的话题聚类
     */
    Optional<UserTopicCluster> findByUserIdAndReportDate(Long userId, LocalDate reportDate);
}
