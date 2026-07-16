package com.infodigest.repository;

import com.infodigest.entity.InformationItem;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface InformationItemRepository extends JpaRepository<InformationItem, Long> {
    List<InformationItem> findByUserId(Long userId);
    Page<InformationItem> findByUserId(Long userId, Pageable pageable);
    List<InformationItem> findByUserIdAndProcessStatus(Long userId, String processStatus);
    Optional<InformationItem> findByIdAndUserId(Long id, Long userId);
    long countByUserIdAndPlatform(Long userId, String platform);
    List<InformationItem> findByAiSummaryIsNull(Pageable pageable);
}
