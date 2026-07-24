package com.infodigest.repository;

import com.infodigest.entity.NodePosition;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface NodePositionRepository extends JpaRepository<NodePosition, Long> {
    List<NodePosition> findByUserId(Long userId);
    Optional<NodePosition> findByUserIdAndNodeId(Long userId, String nodeId);
}
