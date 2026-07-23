package com.infodigest.repository;

import com.infodigest.entity.ReviewCard;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface ReviewCardRepository extends JpaRepository<ReviewCard, Long> {
    List<ReviewCard> findByUserIdAndScheduledReviewDate(Long userId, LocalDate scheduledReviewDate);

    List<ReviewCard> findByUserIdAndScheduledReviewDateLessThanEqualOrderByScheduledReviewDateAsc(Long userId, LocalDate date);

    void deleteByUserIdAndScheduledReviewDate(Long userId, LocalDate scheduledReviewDate);
}
