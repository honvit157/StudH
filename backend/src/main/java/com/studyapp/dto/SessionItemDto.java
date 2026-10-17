package com.studyapp.dto;

import java.util.List;
import java.util.UUID;

public record SessionItemDto(
        UUID itemId,
        UUID lessonId,
        String lessonTitle,
        String prompt,
        String intro,
        String answer,
        List<String> options, // Answer + 3 distractors shuffled
        String explanation,
        String sourceQuote,
        boolean introduced,
        boolean isReview
) {}
