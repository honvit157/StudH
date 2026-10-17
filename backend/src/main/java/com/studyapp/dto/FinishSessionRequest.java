package com.studyapp.dto;

import java.util.List;
import java.util.UUID;

public record FinishSessionRequest(
        int totalQuestions,
        int correctCount,
        int incorrectCount,
        int totalXpEarned,
        boolean isPerfect,
        List<UUID> failedItemIds
) {}
