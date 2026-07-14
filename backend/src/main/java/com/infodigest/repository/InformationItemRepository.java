package com.infodigest.repository;

import com.infodigest.entity.InformationItem;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface InformationItemRepository extends JpaRepository<InformationItem, Long> {
    List<InformationItem> findByUserId(Long userId);
    List<InformationItem> findByUserIdAndProcessStatus(Long userId, String processStatus);
    List<InformationItem> findByProcessStatus(String processStatus, Pageable pageable);
    Optional<InformationItem> findByIdAndUserId(Long id, Long userId);
}
