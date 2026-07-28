package com.infodigest.repository;

import com.infodigest.entity.QuoteExtract;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface QuoteExtractRepository extends JpaRepository<QuoteExtract, Long> {
    List<QuoteExtract> findByUserIdOrderByCreatedAtDesc(Long userId);

    List<QuoteExtract> findByItemId(Long itemId);

    void deleteByUserId(Long userId);

    void deleteByItemIdIn(java.util.Collection<Long> itemIds);
}
