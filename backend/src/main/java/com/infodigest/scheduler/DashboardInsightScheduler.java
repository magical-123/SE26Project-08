package com.infodigest.scheduler;

import com.infodigest.entity.User;
import com.infodigest.repository.UserRepository;
import com.infodigest.service.DashboardInsightService;
import com.infodigest.service.ReviewCardGenerationService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * 仪表盘洞察和复习卡片生成调度器
 * 每日 0 点自动为所有用户生成仪表盘 AI 洞察和复习卡片
 */
@Component
@Slf4j
public class DashboardInsightScheduler {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private DashboardInsightService dashboardInsightService;

    @Autowired
    private ReviewCardGenerationService reviewCardGenerationService;

    /**
     * 每天凌晨 0 点执行
     * cron 表达式：秒 分 时 日 月 周
     */
    @Scheduled(cron = "0 0 0 * * ?")
    public void generateDailyInsightsAndReviews() {
        log.info("====== 开始执行每日仪表盘洞察和复习卡片生成任务 ======");

        try {
            List<User> allUsers = userRepository.findAll();
            int insightSuccessCount = 0;
            int insightFailCount = 0;
            int reviewSuccessCount = 0;
            int reviewFailCount = 0;

            for (User user : allUsers) {
                // 生成洞察
                try {
                    log.info("为用户 {} ({}) 生成仪表盘洞察", user.getUsername(), user.getId());
                    dashboardInsightService.generateDashboardInsight(user.getId());
                    insightSuccessCount++;
                } catch (Exception e) {
                    log.error("为用户 {} ({}) 生成洞察失败: {}", user.getUsername(), user.getId(), e.getMessage());
                    insightFailCount++;
                }

                // 生成复习卡片
                try {
                    log.info("为用户 {} ({}) 生成复习卡片", user.getUsername(), user.getId());
                    reviewCardGenerationService.generateTodayReviewCard(user.getId());
                    reviewSuccessCount++;
                } catch (Exception e) {
                    log.error("为用户 {} ({}) 生成复习卡片失败: {}", user.getUsername(), user.getId(), e.getMessage());
                    reviewFailCount++;
                }
            }

            log.info("====== 每日任务完成：洞察成功 {}，失败 {}；复习卡片成功 {}，失败 {} ======",
                    insightSuccessCount, insightFailCount, reviewSuccessCount, reviewFailCount);

        } catch (Exception e) {
            log.error("每日洞察和复习卡片生成任务执行失败: {}", e.getMessage(), e);
        }
    }
}
