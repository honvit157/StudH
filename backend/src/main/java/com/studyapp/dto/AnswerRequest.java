package com.studyapp.dto;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record AnswerRequest(
        @NotNull UUID itemId,
        @NotNull String selectedAnswer,
        long responseMs,
        boolean isRetry
) {}
