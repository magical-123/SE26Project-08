package com.infodigest.service;

/** Shared validation rules for all Inbox ingestion paths. */
public final class InformationItemPolicy {
    private InformationItemPolicy() {}

    public static boolean isValidTitle(String title) {
        return title != null && !title.isBlank() && !isMetadataTitle(title);
    }

    public static boolean isMetadataTitle(String title) {
        if (title == null || title.isBlank()) return true;
        String value = title.trim();
        return value.startsWith("发布于") || value.startsWith("发表于")
                || value.startsWith("编辑于") || value.startsWith("更新于")
                || value.startsWith("浏览于") || value.startsWith("赞于")
                || value.startsWith("收藏于")
                || value.matches("^[?？]{2,}\\s*\\d{4}[-/.年\\s].*");
    }
}
