package com.infodigest.repository;

import com.infodigest.entity.InformationItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface InformationItemRepository extends JpaRepository<InformationItem, Long> {
    List<InformationItem> findByUserIdAndProcessStatus(Long userId, String processStatus);
}
