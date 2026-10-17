package com.studyapp.dto;

public record AnswerResponse(
        boolean correct,
        String correctAnswer,
        String explanation,
        String sourceQuote,
        int xpEarned,
        int quality,
        boolean shouldRepeatInSession
) {}
