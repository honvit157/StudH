package com.studyapp.dto;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record PathResponse(
        UUID courseId,
        String courseTitle,
        LocalDate examDate,
        int dailyMinutes,
        List<UnitDto> units
) {
    public record UnitDto(
            UUID id,
            int sortOrder,
            String title,
            List<SectionDto> sections
    ) {}

    public record SectionDto(
            UUID id,
            int sortOrder,
            String title,
            List<LessonDto> lessons
    ) {}

    public record LessonDto(
            UUID id,
            int sortOrder,
            String title,
            String status, // locked | ready | generating | done
            LocalDate scheduledDate,
            Integer bestScore,
            int itemCount
    ) {}
}
