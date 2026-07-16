package com.infodigest.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "node_positions", uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "node_id"}))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class NodePosition {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "node_id", nullable = false)
    private String nodeId;

    @Column(name = "pos_x", nullable = false)
    private Double posX;

    @Column(name = "pos_y", nullable = false)
    private Double posY;
}
