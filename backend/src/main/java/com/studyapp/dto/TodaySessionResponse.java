package com.studyapp.dto;

import java.util.List;

public record TodaySessionResponse(
        String courseTitle,
        int totalItems,
        int reviewCount,
        int newCount,
        int estimatedMinutes,
        List<SessionItemDto> items,
        String lessonTitle,
        LessonOverviewDto overview
) {
    public TodaySessionResponse(String courseTitle, int totalItems, int reviewCount, int newCount, int estimatedMinutes, List<SessionItemDto> items) {
        this(courseTitle, totalItems, reviewCount, newCount, estimatedMinutes, items, courseTitle, null);
    }
}
