package com.infodigest.repository;

import com.infodigest.entity.Concept;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ConceptRepository extends JpaRepository<Concept, Long> {
    List<Concept> findByUserId(Long userId);
}
