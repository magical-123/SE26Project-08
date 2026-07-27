package com.infodigest.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.infodigest.entity.InformationItem;
import com.infodigest.repository.InformationItemRepository;
import com.infodigest.repository.UserReportRepository;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.lang.reflect.Method;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

class InsightServiceTest {
    @Test
    void nutritionDistributionUsesRealViewingDurationOnly() throws Exception {
        InsightService service = new InsightService();
        ReflectionTestUtils.setField(service, "reportRepository", mock(UserReportRepository.class));
        ReflectionTestUtils.setField(service, "itemRepository", mock(InformationItemRepository.class));
        ReflectionTestUtils.setField(service, "objectMapper", new ObjectMapper());

        InformationItem watched = new InformationItem();
        watched.setWatchDurationSeconds(100);
        watched.setDurationMinutes(60);
        watched.setNutritionProtein(50);
        watched.setNutritionFats(50);
        InformationItem estimateOnly = new InformationItem();
        estimateOnly.setDurationMinutes(60);
        estimateOnly.setNutritionProtein(100);

        Method method = InsightService.class.getDeclaredMethod("calculateNutritionDistribution", List.class);
        method.setAccessible(true);
        @SuppressWarnings("unchecked")
        Map<String, Integer> result = (Map<String, Integer>) method.invoke(service, List.of(watched, estimateOnly));

        assertEquals(50, result.get("protein"));
        assertEquals(50, result.get("fats"));
        assertEquals(0, result.get("carbs"));
        assertEquals(100, result.values().stream().mapToInt(Integer::intValue).sum());
    }
}
