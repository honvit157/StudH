package com.studyapp.dto;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record ScheduleResponse(
        int dailyMinutes,
        boolean hasOverload,
        String warningMessage,
        List<DayScheduleDto> scheduleDays
) {
    public record DayScheduleDto(
            LocalDate date,
            int newLessonCount,
            int reviewItemCount,
            double estimatedMinutes,
            boolean isOverloaded,
            boolean isRevisionOnlyDay,
            List<LessonSummaryDto> lessons
    ) {}

    public record LessonSummaryDto(
            UUID id,
            String title,
            String status
    ) {}
}
