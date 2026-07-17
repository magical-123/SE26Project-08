package com.infodigest.repository;

import com.infodigest.entity.AIConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface AIConfigRepository extends JpaRepository<AIConfig, Long> {
    Optional<AIConfig> findByUserId(Long userId);
}
