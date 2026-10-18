package com.studyapp.dto;

import java.util.List;

public record LessonOverviewDto(
        String title,
        String description,
        List<String> keyPoints,
        List<ConceptItemDto> concepts
) {
    public record ConceptItemDto(
            String term,
            String explanation,
            String tag
    ) {}
}
