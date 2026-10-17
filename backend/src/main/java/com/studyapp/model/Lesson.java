package com.studyapp.model;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "lessons")
public class Lesson {
    @Id
    private UUID id;

    @Column(nullable = false)
    private UUID sectionId;

    @Column(nullable = false)
    private int sortOrder = 0;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String sourceText;

    @Column(nullable = false)
    private String status = "locked"; // locked | ready | generating | done

    private LocalDate scheduledDate;

    private Integer bestScore;

    private OffsetDateTime completedAt;

    public Lesson() {
        this.id = UUID.randomUUID();
    }

    public Lesson(UUID sectionId, int sortOrder, String title, String sourceText) {
        this();
        this.sectionId = sectionId;
        this.sortOrder = sortOrder;
        this.title = title;
        this.sourceText = sourceText;
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getSectionId() { return sectionId; }
    public void setSectionId(UUID sectionId) { this.sectionId = sectionId; }

    public int getSortOrder() { return sortOrder; }
    public void setSortOrder(int sortOrder) { this.sortOrder = sortOrder; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getSourceText() { return sourceText; }
    public void setSourceText(String sourceText) { this.sourceText = sourceText; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public LocalDate getScheduledDate() { return scheduledDate; }
    public void setScheduledDate(LocalDate scheduledDate) { this.scheduledDate = scheduledDate; }

    public Integer getBestScore() { return bestScore; }
    public void setBestScore(Integer bestScore) { this.bestScore = bestScore; }

    public OffsetDateTime getCompletedAt() { return completedAt; }
    public void setCompletedAt(OffsetDateTime completedAt) { this.completedAt = completedAt; }
}
