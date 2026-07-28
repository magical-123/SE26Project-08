package com.infodigest.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AnalysisResponse {
    private Long itemId;
    private Integer knowledgeScore;
    private String scoreReasoning;
    private String aiSummary;
    private String status; // SUCCESS, FAILED
    private String message;
}
