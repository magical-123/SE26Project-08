package com.infodigest.scheduler;

import com.infodigest.entity.ReportType;
import com.infodigest.entity.User;
import com.infodigest.repository.UserRepository;
import com.infodigest.service.InsightService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;

/**
 * 自动生成数字饮食日报和周报。
 *
 * 日报在每天 23:50 汇总当天数据；周报在周日 23:55 汇总本周数据。
 * 单个用户失败不会中断其他用户的报告生成。
 */
@Component
@Slf4j
public class ReportGenerationScheduler {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private InsightService insightService;

    @Scheduled(cron = "0 50 23 * * ?", zone = "Asia/Shanghai")
    public void generateDailyReports() {
        generateReports(ReportType.DAILY, LocalDate.now());
    }

    @Scheduled(cron = "0 55 23 ? * SUN", zone = "Asia/Shanghai")
    public void generateWeeklyReports() {
        generateReports(ReportType.WEEKLY, LocalDate.now());
    }

    private void generateReports(ReportType type, LocalDate reportDate) {
        List<User> users = userRepository.findAll();
        int success = 0;
        int skippedOrFailed = 0;

        for (User user : users) {
            try {
                insightService.generateInsight(user.getId(), type, reportDate);
                success++;
            } catch (Exception e) {
                // 没有有效摄入数据时属于正常跳过，不影响整个调度任务。
                skippedOrFailed++;
                log.warn("用户 {} 的 {} 报告未生成: {}", user.getId(), type, e.getMessage());
            }
        }

        log.info("{} 报告生成结束：成功 {}，跳过或失败 {}", type, success, skippedOrFailed);
    }
}
