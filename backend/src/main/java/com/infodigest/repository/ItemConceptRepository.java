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
    @org.springframework.transaction.annotation.Transactional
    @org.springframework.data.jpa.repository.Modifying
    void deleteByItemId(Long itemId);
    
    @org.springframework.transaction.annotation.Transactional
    @org.springframework.data.jpa.repository.Modifying
    void deleteByConceptId(Long conceptId);

    @org.springframework.transaction.annotation.Transactional
    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query(value = "DELETE ic FROM item_concepts ic LEFT JOIN information_items i ON i.id = ic.item_id LEFT JOIN concepts c ON c.id = ic.concept_id WHERE i.id IS NULL OR c.id IS NULL", nativeQuery = true)
    int deleteOrphanMappings();
}
