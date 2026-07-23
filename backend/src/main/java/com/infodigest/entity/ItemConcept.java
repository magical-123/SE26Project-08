package com.infodigest.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "item_concepts")
@Data
@NoArgsConstructor
public class ItemConcept {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long itemId;

    @Column(nullable = false)
    private Long conceptId;

    /** 前端是否高亮显示，默认 true */
    @Column(nullable = false)
    private Boolean highlighted = true;
}
