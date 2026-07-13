package com.infodigest.repository;

import com.infodigest.entity.ReportType;
import com.infodigest.entity.UserReport;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.Optional;

@Repository
public interface UserReportRepository extends JpaRepository<UserReport, Long> {
    Optional<UserReport> findByUserIdAndTypeAndReportDate(Long userId, ReportType type, LocalDate reportDate);
}
