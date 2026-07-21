package com.infodigest.scheduler;

import com.infodigest.entity.User;
import com.infodigest.repository.UserRepository;
import com.infodigest.service.DashboardInsightService;
import com.infodigest.service.ReviewCardGenerationService;
import com.infodigest.service.WordCloudService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;

/**
 * 仪表盘数据生成调度器
 * 每日 0 点自动为所有用户生成：洞察、复习卡片、词云
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

    @Autowired
    private WordCloudService wordCloudService;

    /**
     * 每天凌晨 0 点执行
     * cron 表达式：秒 分 时 日 月 周
     */
    @Scheduled(cron = "0 0 0 * * ?")
    public void generateDailyData() {
        log.info("====== 开始执行每日仪表盘数据生成任务 ======");

        try {
            List<User> allUsers = userRepository.findAll();
            int insightSuccessCount = 0;
            int insightFailCount = 0;
            int reviewSuccessCount = 0;
            int reviewFailCount = 0;
            int wordCloudSuccessCount = 0;
            int wordCloudFailCount = 0;

            LocalDate yesterday = LocalDate.now().minusDays(1); // 生成昨天的词云

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

                // 生成昨天的词云
                try {
                    log.info("为用户 {} ({}) 生成词云数据", user.getUsername(), user.getId());
                    wordCloudService.generateWordCloud(user.getId(), yesterday);
                    wordCloudSuccessCount++;
                } catch (Exception e) {
                    log.error("为用户 {} ({}) 生成词云失败: {}", user.getUsername(), user.getId(), e.getMessage());
                    wordCloudFailCount++;
                }
            }

            log.info("====== 每日任务完成 ======");
            log.info("洞察：成功 {}，失败 {}", insightSuccessCount, insightFailCount);
            log.info("复习卡片：成功 {}，失败 {}", reviewSuccessCount, reviewFailCount);
            log.info("词云：成功 {}，失败 {}", wordCloudSuccessCount, wordCloudFailCount);

        } catch (Exception e) {
            log.error("每日数据生成任务执行失败: {}", e.getMessage(), e);
        }
    }
}
