package com.infodigest.controller;

import com.infodigest.config.BaseIntegrationTest;
import com.infodigest.entity.QuoteExtract;
import com.infodigest.repository.QuoteExtractRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.LocalDateTime;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class QuoteExtractControllerIntegrationTest extends BaseIntegrationTest {

    @Autowired
    private QuoteExtractRepository quoteExtractRepository;

    @Override
    @BeforeEach
    public void setUpBase() throws Exception {
        super.setUpBase();
        quoteExtractRepository.deleteAll();
    }

    @Test
    void getQuotes_ReturnsEmptyListWhenNoQuotes() throws Exception {
        mockMvc.perform(get("/api/quotes")
                        .header("Authorization", "Bearer " + testToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void getQuotes_ReturnsQuotes() throws Exception {
        QuoteExtract quote = new QuoteExtract();
        quote.setUserId(testUserId);
        quote.setItemId(1L);
        quote.setContent("Test quote content");
        quote.setReason("Test reason");
        quote.setSourceTitle("Test Source");
        quote.setCreatedAt(LocalDateTime.now().minusHours(1));
        quoteExtractRepository.save(quote);

        mockMvc.perform(get("/api/quotes")
                        .header("Authorization", "Bearer " + testToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].content").value("Test quote content"))
                .andExpect(jsonPath("$[0].userId").value(testUserId));
    }

    @Test
    void getQuotes_LimitsTo20() throws Exception {
        for (int i = 0; i < 25; i++) {
            QuoteExtract quote = new QuoteExtract();
            quote.setUserId(testUserId);
            quote.setItemId((long) i);
            quote.setContent("Quote " + i);
            quoteExtractRepository.save(quote);
        }

        mockMvc.perform(get("/api/quotes")
                        .header("Authorization", "Bearer " + testToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(20)));
    }

    @Test
    void deleteQuote_WithValidId_Returns204() throws Exception {
        QuoteExtract quote = new QuoteExtract();
        quote.setUserId(testUserId);
        quote.setItemId(1L);
        quote.setContent("Quote to delete");
        quote = quoteExtractRepository.save(quote);

        mockMvc.perform(delete("/api/quotes/{id}", quote.getId())
                        .header("Authorization", "Bearer " + testToken))
                .andExpect(status().isNoContent());
    }
}
