package com.studyapp.dto;

import java.util.UUID;

public record TaskStatusDto(
        UUID taskId,
        String status, // PROCESSING | COMPLETED | FAILED
        int progress,  // 0 - 100
        String message,
        UUID courseId,
        String error
) {}
