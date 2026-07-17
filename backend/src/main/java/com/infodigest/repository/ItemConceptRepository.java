package com.infodigest.repository;

import com.infodigest.entity.ItemConcept;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ItemConceptRepository extends JpaRepository<ItemConcept, Long> {
    List<ItemConcept> findByItemId(Long itemId);
    List<ItemConcept> findByConceptId(Long conceptId);
    List<ItemConcept> findByItemIdIn(List<Long> itemIds);
    Optional<ItemConcept> findByItemIdAndConceptId(Long itemId, Long conceptId);
}
