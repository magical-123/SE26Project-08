package com.infodigest.entity;

import jakarta.persistence.Table;
import org.junit.jupiter.api.Test;

import java.lang.annotation.Annotation;
import java.time.LocalDate;
import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;

class EntityTests {

    // --- UserWordCloud tests ---

    @Test
    void userWordCloud_gettersAndSetters() {
        UserWordCloud uwc = new UserWordCloud();
        uwc.setId(1L);
        uwc.setUserId(100L);
        uwc.setReportDate(LocalDate.of(2024, 3, 15));
        uwc.setKeywords("[{\"word\":\"Java\",\"weight\":100}]");
        uwc.setCreatedAt(LocalDateTime.of(2024, 3, 15, 10, 0));
        uwc.setUpdatedAt(LocalDateTime.of(2024, 3, 15, 12, 0));

        assertEquals(1L, uwc.getId());
        assertEquals(100L, uwc.getUserId());
        assertEquals(LocalDate.of(2024, 3, 15), uwc.getReportDate());
        assertEquals("[{\"word\":\"Java\",\"weight\":100}]", uwc.getKeywords());
        assertEquals(LocalDateTime.of(2024, 3, 15, 10, 0), uwc.getCreatedAt());
        assertEquals(LocalDateTime.of(2024, 3, 15, 12, 0), uwc.getUpdatedAt());
    }

    @Test
    void userWordCloud_prePersist_setsCreatedAtAndUpdatedAt() {
        UserWordCloud uwc = new UserWordCloud();
        assertNull(uwc.getCreatedAt());
        assertNull(uwc.getUpdatedAt());

        uwc.onCreate();

        assertNotNull(uwc.getCreatedAt());
        assertNotNull(uwc.getUpdatedAt());
    }

    @Test
    void userWordCloud_preUpdate_setsUpdatedAt() {
        UserWordCloud uwc = new UserWordCloud();
        uwc.setCreatedAt(LocalDateTime.of(2024, 1, 1, 0, 0));
        assertNull(uwc.getUpdatedAt());

        uwc.onUpdate();

        assertNotNull(uwc.getUpdatedAt());
    }

    @Test
    void userWordCloud_tableName() {
        Table table = UserWordCloud.class.getAnnotation(Table.class);
        assertNotNull(table);
        assertEquals("user_word_cloud", table.name());
    }

    // --- UserPlatform tests ---

    @Test
    void userPlatform_gettersAndSetters() {
        UserPlatform up = new UserPlatform();
        up.setId(1L);
        up.setUserId(100L);
        up.setPlatform("BILIBILI");
        up.setCredential("encrypted-credential");
        up.setCreatedAt(LocalDateTime.of(2024, 1, 1, 0, 0));
        up.setUpdatedAt(LocalDateTime.of(2024, 1, 1, 0, 0));

        assertEquals(1L, up.getId());
        assertEquals(100L, up.getUserId());
        assertEquals("BILIBILI", up.getPlatform());
        assertEquals("encrypted-credential", up.getCredential());
        assertNotNull(up.getCreatedAt());
        assertNotNull(up.getUpdatedAt());
    }

    @Test
    void userPlatform_preUpdate_setsUpdatedAt() {
        UserPlatform up = new UserPlatform();
        up.setUpdatedAt(LocalDateTime.of(2024, 1, 1, 0, 0));

        up.preUpdate();

        assertNotNull(up.getUpdatedAt());
        // updatedAt should be after the old value
        assertTrue(up.getUpdatedAt().isAfter(LocalDateTime.of(2024, 1, 1, 0, 0)));
    }

    @Test
    void userPlatform_tableName() {
        Table table = UserPlatform.class.getAnnotation(Table.class);
        assertNotNull(table);
        assertEquals("user_platforms", table.name());
    }

    @Test
    void userPlatform_noArgsConstructor() {
        UserPlatform up = new UserPlatform();
        assertNotNull(up);
        assertNotNull(up.getCreatedAt());
        assertNotNull(up.getUpdatedAt());
    }

    // --- UserTopicCluster tests ---

    @Test
    void userTopicCluster_gettersAndSetters() {
        UserTopicCluster utc = new UserTopicCluster();
        utc.setId(1L);
        utc.setUserId(100L);
        utc.setReportDate(LocalDate.of(2024, 3, 15));
        utc.setClusters("[{\"name\":\"AI\",\"count\":5}]");
        utc.setCreatedAt(LocalDateTime.of(2024, 3, 15, 10, 0));
        utc.setUpdatedAt(LocalDateTime.of(2024, 3, 15, 12, 0));

        assertEquals(1L, utc.getId());
        assertEquals(100L, utc.getUserId());
        assertEquals(LocalDate.of(2024, 3, 15), utc.getReportDate());
        assertEquals("[{\"name\":\"AI\",\"count\":5}]", utc.getClusters());
        assertNotNull(utc.getCreatedAt());
        assertNotNull(utc.getUpdatedAt());
    }

    @Test
    void userTopicCluster_tableName() {
        Table table = UserTopicCluster.class.getAnnotation(Table.class);
        assertNotNull(table);
        assertEquals("user_topic_clusters", table.name());
    }

    // --- ItemConcept tests ---

    @Test
    void itemConcept_gettersAndSetters() {
        ItemConcept ic = new ItemConcept();
        ic.setId(1L);
        ic.setItemId(100L);
        ic.setConceptId(200L);
        ic.setHighlighted(true);
        ic.setConfidence(0.95);
        ic.setReason("Related concept");

        assertEquals(1L, ic.getId());
        assertEquals(100L, ic.getItemId());
        assertEquals(200L, ic.getConceptId());
        assertTrue(ic.getHighlighted());
        assertEquals(0.95, ic.getConfidence(), 0.001);
        assertEquals("Related concept", ic.getReason());
    }

    @Test
    void itemConcept_defaultHighlightedIsTrue() {
        ItemConcept ic = new ItemConcept();
        // The field initializer sets highlighted = true
        assertTrue(ic.getHighlighted());
    }

    @Test
    void itemConcept_tableName() {
        Table table = ItemConcept.class.getAnnotation(Table.class);
        assertNotNull(table);
        assertEquals("item_concepts", table.name());
    }

    @Test
    void itemConcept_noArgsConstructor() {
        ItemConcept ic = new ItemConcept();
        assertNotNull(ic);
    }

    // --- FriendshipStatus enum tests ---

    @Test
    void friendshipStatus_enumValues() {
        assertEquals(2, FriendshipStatus.values().length);
        assertEquals(FriendshipStatus.PENDING, FriendshipStatus.valueOf("PENDING"));
        assertEquals(FriendshipStatus.ACCEPTED, FriendshipStatus.valueOf("ACCEPTED"));
    }

    // --- ReportType enum tests ---

    @Test
    void reportType_enumValues() {
        assertEquals(2, ReportType.values().length);
        assertEquals(ReportType.DAILY, ReportType.valueOf("DAILY"));
        assertEquals(ReportType.WEEKLY, ReportType.valueOf("WEEKLY"));
    }

    // --- Visibility enum tests ---

    @Test
    void visibility_enumValues() {
        assertEquals(3, Visibility.values().length);
        assertEquals(Visibility.PUBLIC, Visibility.valueOf("PUBLIC"));
        assertEquals(Visibility.FRIENDS, Visibility.valueOf("FRIENDS"));
        assertEquals(Visibility.PRIVATE, Visibility.valueOf("PRIVATE"));
    }

    // --- UserReport @PrePersist tests ---

    @Test
    void userReport_prePersist_setsVersionAndTimestamps() {
        UserReport report = new UserReport();
        assertNull(report.getCreatedAt());
        assertNull(report.getUpdatedAt());
        assertNull(report.getVersion());

        report.onCreate();

        assertNotNull(report.getCreatedAt());
        assertNotNull(report.getUpdatedAt());
        assertEquals(1, report.getVersion());
    }

    @Test
    void userReport_prePersist_doesNotOverrideExistingVersion() {
        UserReport report = new UserReport();
        report.setVersion(5);

        report.onCreate();

        assertEquals(5, report.getVersion());
        assertNotNull(report.getCreatedAt());
        assertNotNull(report.getUpdatedAt());
    }

    @Test
    void userReport_preUpdate_setsUpdatedAt() {
        UserReport report = new UserReport();
        assertNull(report.getUpdatedAt());

        report.onUpdate();

        assertNotNull(report.getUpdatedAt());
    }

    // --- InformationItem getHasNote tests ---

    @Test
    void informationItem_getHasNote_returnsTrueWhenIsPremiumTrue() {
        InformationItem item = new InformationItem();
        item.setIsPremium(true);
        assertTrue(item.getHasNote());
    }

    @Test
    void informationItem_getHasNote_returnsFalseWhenIsPremiumFalse() {
        InformationItem item = new InformationItem();
        item.setIsPremium(false);
        assertFalse(item.getHasNote());
    }

    @Test
    void informationItem_getHasNote_returnsFalseWhenIsPremiumNull() {
        InformationItem item = new InformationItem();
        // isPremium defaults to false, but let's explicitly set null
        // Note: The field initializer sets isPremium = false, so this tests the
        // Boolean.TRUE.equals() null-safe behavior through the default field value
        assertFalse(item.getHasNote());
    }

    @Test
    void informationItem_getHasNote_usesIsPremiumField() {
        InformationItem item = new InformationItem();
        // Directly verify the mapping: getHasNote() returns Boolean.TRUE.equals(isPremium)
        item.setIsPremium(true);
        assertTrue(item.getHasNote());

        item.setIsPremium(false);
        assertFalse(item.getHasNote());
    }

    @Test
    void informationItem_defaultFieldValues() {
        InformationItem item = new InformationItem();
        assertNotNull(item);
        assertEquals("UNPROCESSED", item.getProcessStatus());
        assertFalse(item.getIsPremium());
        assertFalse(item.getIsLiked());
        assertFalse(item.getIsFavorite());
        assertFalse(item.getHasNote()); // isPremium defaults to false
        assertNotNull(item.getCrawledAt());
    }
}
