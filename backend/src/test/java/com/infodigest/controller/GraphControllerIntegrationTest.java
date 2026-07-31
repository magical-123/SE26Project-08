package com.infodigest.controller;

import com.infodigest.config.BaseIntegrationTest;
import com.infodigest.entity.Concept;
import com.infodigest.entity.InformationItem;
import com.infodigest.entity.ItemConcept;
import com.infodigest.entity.NodePosition;
import com.infodigest.repository.ConceptRepository;
import com.infodigest.repository.InformationItemRepository;
import com.infodigest.repository.ItemConceptRepository;
import com.infodigest.repository.NodePositionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.LocalDateTime;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class GraphControllerIntegrationTest extends BaseIntegrationTest {

    @Autowired
    private ConceptRepository conceptRepository;

    @Autowired
    private InformationItemRepository informationItemRepository;

    @Autowired
    private ItemConceptRepository itemConceptRepository;

    @Autowired
    private NodePositionRepository nodePositionRepository;

    @Override
    @BeforeEach
    public void setUpBase() throws Exception {
        super.setUpBase();
    }

    @Test
    void getGraphData_returnsGraphNodesAndEdges() throws Exception {
        // Create a concept
        Concept concept = new Concept();
        concept.setUserId(testUserId);
        concept.setName("test-concept");
        concept.setLabel("测试概念");
        concept.setColor("#0EA5E9");
        concept = conceptRepository.save(concept);

        // Create a premium item (hasNote returns isPremium)
        InformationItem item = new InformationItem();
        item.setUserId(testUserId);
        item.setTitle("Test Premium Item");
        item.setPlatform("BILIBILI");
        item.setProcessStatus("PROCESSED");
        item.setIsPremium(true);
        item.setCrawledAt(LocalDateTime.now());
        item = informationItemRepository.save(item);

        // Create mapping (highlighted = true)
        ItemConcept mapping = new ItemConcept();
        mapping.setItemId(item.getId());
        mapping.setConceptId(concept.getId());
        mapping.setHighlighted(true);
        itemConceptRepository.save(mapping);

        mockMvc.perform(get("/api/graph/data")
                        .header("Authorization", "Bearer " + testToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.concepts").isArray())
                .andExpect(jsonPath("$.items").isArray())
                .andExpect(jsonPath("$.itemToConcepts").isMap());
    }

    @Test
    void savePositions_savesNodePositions() throws Exception {
        String requestBody = """
                [
                    {
                        "nodeId": "concept-test",
                        "posX": 100.0,
                        "posY": 200.0
                    },
                    {
                        "nodeId": "concept-test2",
                        "posX": 300.0,
                        "posY": 400.0
                    }
                ]
                """;

        mockMvc.perform(put("/api/graph/positions")
                        .header("Authorization", "Bearer " + testToken)
                        .contentType("application/json")
                        .content(requestBody))
                .andExpect(status().isOk());
    }

    @Test
    void getConcepts_returnsConceptsForCurrentUser() throws Exception {
        // Create some concepts for the test user
        Concept concept1 = new Concept();
        concept1.setUserId(testUserId);
        concept1.setName("frontend-arch");
        concept1.setLabel("前端架构演进");
        concept1.setColor("#0EA5E9");
        conceptRepository.save(concept1);

        Concept concept2 = new Concept();
        concept2.setUserId(testUserId);
        concept2.setName("ml-basics");
        concept2.setLabel("机器学习基础");
        concept2.setColor("#10B981");
        conceptRepository.save(concept2);

        mockMvc.perform(get("/api/graph/concepts")
                        .header("Authorization", "Bearer " + testToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].label").isString())
                .andExpect(jsonPath("$[1].label").isString());
    }

    @Test
    void getGraphData_withNoPremiumItems_returnsEmptyGraph() throws Exception {
        // Create concept but no premium items with mappings
        Concept concept = new Concept();
        concept.setUserId(testUserId);
        concept.setName("orphan-concept");
        concept.setLabel("孤立概念");
        concept.setColor("#F43F5E");
        conceptRepository.save(concept);

        mockMvc.perform(get("/api/graph/data")
                        .header("Authorization", "Bearer " + testToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.concepts").isArray())
                .andExpect(jsonPath("$.items").isArray())
                .andExpect(jsonPath("$.itemToConcepts").isMap());
    }

    @Test
    void getConcepts_whenEmpty_returnsEmptyList() throws Exception {
        mockMvc.perform(get("/api/graph/concepts")
                        .header("Authorization", "Bearer " + testToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void updateConceptPositions_updatesConceptPositions() throws Exception {
        Concept concept = new Concept();
        concept.setUserId(testUserId);
        concept.setName("movable-concept");
        concept.setLabel("可移动概念");
        concept.setColor("#10B981");
        concept = conceptRepository.save(concept);

        String requestBody = """
                [
                    {
                        "id": %d,
                        "posX": 150.0,
                        "posY": 250.0
                    }
                ]
                """.formatted(concept.getId());

        mockMvc.perform(put("/api/graph/concepts/positions")
                        .header("Authorization", "Bearer " + testToken)
                        .contentType("application/json")
                        .content(requestBody))
                .andExpect(status().isOk());

        // Verify the position was saved
        Concept updated = conceptRepository.findById(concept.getId()).orElseThrow();
        assert updated.getPosX() != null && updated.getPosX() == 150.0 : "posX should be updated";
        assert updated.getPosY() != null && updated.getPosY() == 250.0 : "posY should be updated";
    }

    @Test
    void getPositions_returnsStoredPositions() throws Exception {
        // Save a position first
        NodePosition np = new NodePosition();
        np.setUserId(testUserId);
        np.setNodeId("concept-test");
        np.setPosX(100.0);
        np.setPosY(200.0);
        nodePositionRepository.save(np);

        mockMvc.perform(get("/api/graph/positions")
                        .header("Authorization", "Bearer " + testToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.['concept-test']").exists())
                .andExpect(jsonPath("$.['concept-test'].x").value(100.0))
                .andExpect(jsonPath("$.['concept-test'].y").value(200.0));
    }

    @Test
    void createConcept_createsNewConcept() throws Exception {
        String requestBody = """
                {
                    "name": "new-concept",
                    "label": "新概念",
                    "color": "#8B5CF6"
                }
                """;

        mockMvc.perform(post("/api/graph/concepts")
                        .header("Authorization", "Bearer " + testToken)
                        .contentType("application/json")
                        .content(requestBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("new-concept"))
                .andExpect(jsonPath("$.label").value("新概念"))
                .andExpect(jsonPath("$.userId").value(testUserId));
    }

    @Test
    void deletePositions_clearsAllPositions() throws Exception {
        // Save a position first
        NodePosition np = new NodePosition();
        np.setUserId(testUserId);
        np.setNodeId("concept-to-delete");
        np.setPosX(500.0);
        np.setPosY(600.0);
        nodePositionRepository.save(np);

        mockMvc.perform(delete("/api/graph/positions")
                        .header("Authorization", "Bearer " + testToken))
                .andExpect(status().isOk());

        // Verify positions are cleared
        assert nodePositionRepository.findByUserId(testUserId).isEmpty() : "All positions should be deleted";
    }

    @Test
    void getGraphData_withEdgesBetweenNodes() throws Exception {
        // Create two concepts
        Concept c1 = new Concept();
        c1.setUserId(testUserId);
        c1.setName("concept-a");
        c1.setLabel("概念A");
        c1.setColor("#0EA5E9");
        c1 = conceptRepository.save(c1);

        Concept c2 = new Concept();
        c2.setUserId(testUserId);
        c2.setName("concept-b");
        c2.setLabel("概念B");
        c2.setColor("#F59E0B");
        c2 = conceptRepository.save(c2);

        // Create a premium item linked to both concepts
        InformationItem item = new InformationItem();
        item.setUserId(testUserId);
        item.setTitle("Linked Item");
        item.setPlatform("GITHUB");
        item.setProcessStatus("PROCESSED");
        item.setIsPremium(true);
        item.setCrawledAt(LocalDateTime.now());
        item = informationItemRepository.save(item);

        // Create highlighted mappings
        ItemConcept m1 = new ItemConcept();
        m1.setItemId(item.getId());
        m1.setConceptId(c1.getId());
        m1.setHighlighted(true);
        itemConceptRepository.save(m1);

        ItemConcept m2 = new ItemConcept();
        m2.setItemId(item.getId());
        m2.setConceptId(c2.getId());
        m2.setHighlighted(true);
        itemConceptRepository.save(m2);

        mockMvc.perform(get("/api/graph/data")
                        .header("Authorization", "Bearer " + testToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.concepts").isArray())
                .andExpect(jsonPath("$.concepts.length()").value(2))
                .andExpect(jsonPath("$.items").isArray())
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.itemToConcepts.['" + item.getId() + "']").isArray())
                .andExpect(jsonPath("$.itemToConcepts.['" + item.getId() + "'].length()").value(2));
    }
}
