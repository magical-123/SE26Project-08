package com.infodigest.scheduler;

import com.infodigest.entity.InformationItem;
import com.infodigest.repository.InformationItemRepository;
import com.infodigest.service.AiSummaryService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * AI 摘要定时调度器：每隔一段时间扫描 ai_summary 为 null 的数据，
 * 调用 DeepSeek API 生成摘要、评分和分类
 */
@Component
public class AiSummaryScheduler {

    @Autowired
    private InformationItemRepository informationItemRepository;

    @Autowired
    private AiSummaryService aiSummaryService;

    @Value("${ai.deepseek.batch-size:5}")
    private int batchSize;

    /** 防止上一轮未结束时重复触发 */
    private final AtomicBoolean running = new AtomicBoolean(false);

    /**
     * 每 2 分钟扫描一次未分析的数据（可配置）
     */
    @Scheduled(fixedRateString = "${ai.deepseek.poll-interval-ms:120000}")
    public void scheduledSummary() {
        if (!running.compareAndSet(false, true)) {
            System.out.println("[AiSummaryScheduler] 上一轮摘要尚未结束，跳过");
            return;
        }

        try {
            // 查找最新未被分析的条目（按抓取时间升序，优先处理老数据）
            List<InformationItem> unanalyzed = informationItemRepository.findTopNByAiSummaryIsNull(
                    PageRequest.of(0, batchSize, Sort.by(Sort.Direction.ASC, "crawledAt"))
            );

            if (unanalyzed.isEmpty()) {
                System.out.println("[AiSummaryScheduler] 没有待分析的数据，跳过");
                return;
            }

            System.out.println("[AiSummaryScheduler] 本轮处理 " + unanalyzed.size() + " 条数据");

            int successCount = 0;
            for (InformationItem item : unanalyzed) {
                // 跳过内容太短的项目（只有标题没有正文）
                if (item.getContentRaw() == null || item.getContentRaw().length() < 10) {
                    // 仅用标题也能做摘要
                }

                boolean ok = aiSummaryService.generateSummary(item);
                if (ok) {
                    item.setAnalyzedAt(LocalDateTime.now());
                    informationItemRepository.save(item);
                    successCount++;
                    System.out.println("[AiSummaryScheduler] ✅ 摘要: " + truncate(item.getTitle(), 40)
                            + " | 评分=" + item.getKnowledgeScore()
                            + " | 分类=" + item.getCategory());
                }

                // 每条之间间隔 2 秒，避免 API 限流
                try { Thread.sleep(2000); } catch (InterruptedException ignored) {}
            }

            System.out.println("[AiSummaryScheduler] 本轮完成: 成功 " + successCount + " / 共 " + unanalyzed.size());

        } catch (Exception e) {
            System.err.println("[AiSummaryScheduler] 调度异常: " + e.getMessage());
            e.printStackTrace();
        } finally {
            running.set(false);
        }
    }

    private String truncate(String s, int maxLen) {
        if (s == null) return "null";
        if (s.length() <= maxLen) return s;
        return s.substring(0, maxLen) + "...";
    }
}
