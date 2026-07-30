package com.infodigest.repository;

import com.infodigest.entity.UserWordCloud;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface UserWordCloudRepository extends JpaRepository<UserWordCloud, Long> {

    Optional<UserWordCloud> findFirstByUserIdAndReportDateOrderByCreatedAtDesc(Long userId, LocalDate reportDate);

    List<UserWordCloud> findByUserIdAndReportDateBetweenOrderByReportDateDescCreatedAtDesc(
            Long userId, LocalDate startDate, LocalDate endDate);

    List<UserWordCloud> findByUserIdOrderByReportDateDesc(Long userId);
}
