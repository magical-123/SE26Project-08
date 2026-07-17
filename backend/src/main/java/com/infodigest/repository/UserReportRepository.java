package com.infodigest.repository;

import com.infodigest.entity.ReportType;
import com.infodigest.entity.UserReport;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface UserReportRepository extends JpaRepository<UserReport, Long> {

    // 查询用户某一天的某类型报告（最新版本）
    Optional<UserReport> findFirstByUserIdAndTypeAndReportDateOrderByVersionDesc(
            Long userId, ReportType type, LocalDate reportDate);

    // 兼容旧方法
    default Optional<UserReport> findByUserIdAndTypeAndReportDate(Long userId, ReportType type, LocalDate reportDate) {
        return findFirstByUserIdAndTypeAndReportDateOrderByVersionDesc(userId, type, reportDate);
    }

    // 查询用户某一天的所有版本报告（用于查看历史）
    List<UserReport> findByUserIdAndTypeAndReportDateOrderByVersionDesc(
            Long userId, ReportType type, LocalDate reportDate);

    // 查询用户某类型的所有历史报告（只返回最新版本）
    @Query("SELECT r FROM UserReport r WHERE r.userId = :userId AND r.type = :type " +
           "AND r.version = (SELECT MAX(r2.version) FROM UserReport r2 " +
           "WHERE r2.userId = r.userId AND r2.type = r.type AND r2.reportDate = r.reportDate) " +
           "ORDER BY r.reportDate DESC")
    List<UserReport> findLatestReportsByUserIdAndType(Long userId, ReportType type);

    // 查询用户某个日期范围的报告
    List<UserReport> findByUserIdAndTypeAndReportDateBetweenOrderByReportDateDesc(
            Long userId, ReportType type, LocalDate startDate, LocalDate endDate);

    // 查询用户某个日期范围的报告（升序，用于周报生成）
    List<UserReport> findByUserIdAndTypeAndReportDateBetween(
            Long userId, ReportType type, LocalDate startDate, LocalDate endDate);
}
