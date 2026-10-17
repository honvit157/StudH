package com.studyapp.dto;

import java.util.List;

public record FinishSessionResponse(
        int totalQuestions,
        int correctCount,
        int incorrectCount,
        int totalXpEarned,
        int bonusXp,
        int grandTotalXp,
        int currentStreak,
        boolean isPerfect,
        List<SessionItemDto> failedItems
) {}
