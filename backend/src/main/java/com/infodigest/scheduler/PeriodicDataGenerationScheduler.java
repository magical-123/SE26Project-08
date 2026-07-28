package com.infodigest.scheduler;

import com.infodigest.entity.User;
import com.infodigest.repository.UserRepository;
import com.infodigest.service.WordCloudService;
import com.infodigest.service.TopicClusterService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;

/**
 * 周期性数据生成调度器
 * 每2小时自动为所有用户生成：
 * 1. 今日词云
 * 2. 今日话题聚类
 * 3. 周报话题聚类
 */
@Component
@Slf4j
public class PeriodicDataGenerationScheduler {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private WordCloudService wordCloudService;

    @Autowired
    private TopicClusterService topicClusterService;

    /**
     * 每2小时执行一次
     * cron 表达式: 秒 分 时 日 月 周
     * 0 0 star/2 star star ? 表示: 每2小时的整点执行
     */
    @Scheduled(cron = "0 0 */2 * * ?")
    public void generatePeriodicData() {
        log.info("====== 开始执行周期性数据生成任务 (每2小时) ======");

        try {
            List<User> allUsers = userRepository.findAll();
            int wordCloudSuccessCount = 0;
            int wordCloudFailCount = 0;
            int dailyTopicSuccessCount = 0;
            int dailyTopicFailCount = 0;
            int weeklyTopicSuccessCount = 0;
            int weeklyTopicFailCount = 0;

            LocalDate today = LocalDate.now();

            for (User user : allUsers) {
                // 1. 生成今日词云
                try {
                    log.info("为用户 {} ({}) 生成今日词云", user.getUsername(), user.getId());
                    wordCloudService.generateWordCloud(user.getId(), today);
                    wordCloudSuccessCount++;
                } catch (Exception e) {
                    log.error("为用户 {} ({}) 生成今日词云失败: {}",
                            user.getUsername(), user.getId(), e.getMessage());
                    wordCloudFailCount++;
                }

                // 2. 生成今日话题聚类
                try {
                    log.info("为用户 {} ({}) 生成今日话题聚类", user.getUsername(), user.getId());
                    topicClusterService.generateDailyTopicClusters(user.getId(), today);
                    dailyTopicSuccessCount++;
                } catch (Exception e) {
                    log.error("为用户 {} ({}) 生成今日话题聚类失败: {}",
                            user.getUsername(), user.getId(), e.getMessage());
                    dailyTopicFailCount++;
                }

                // 3. 生成周报话题聚类（截止今日）
                try {
                    log.info("为用户 {} ({}) 生成周报话题聚类", user.getUsername(), user.getId());
                    topicClusterService.generateWeeklyTopicClusters(user.getId(), today);
                    weeklyTopicSuccessCount++;
                } catch (Exception e) {
                    log.error("为用户 {} ({}) 生成周报话题聚类失败: {}",
                            user.getUsername(), user.getId(), e.getMessage());
                    weeklyTopicFailCount++;
                }
            }

            log.info("====== 周期性数据生成任务完成 ======");
            log.info("今日词云：成功 {}，失败 {}", wordCloudSuccessCount, wordCloudFailCount);
            log.info("今日话题聚类：成功 {}，失败 {}", dailyTopicSuccessCount, dailyTopicFailCount);
            log.info("周报话题聚类：成功 {}，失败 {}", weeklyTopicSuccessCount, weeklyTopicFailCount);

        } catch (Exception e) {
            log.error("周期性数据生成任务执行失败: {}", e.getMessage(), e);
        }
    }
}
