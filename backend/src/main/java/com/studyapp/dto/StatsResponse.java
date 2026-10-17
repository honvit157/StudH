package com.studyapp.dto;

import java.util.List;

public record StatsResponse(
        int xp,
        int streak,
        int bestStreak,
        int dailyGoalXp,
        int xpToday,
        long masteredItemsCount, // intervalDays >= 21
        long learningItemsCount,
        long newItemsCount,
        long totalItemsCount,
        long daysUntilExam,
        List<FailedItemStatDto> topFailedItems
) {
    public record FailedItemStatDto(
            String prompt,
            String answer,
            String explanation,
            long failCount
    ) {}
}
