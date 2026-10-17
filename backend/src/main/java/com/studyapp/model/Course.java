package com.studyapp.model;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "courses")
public class Course {
    @Id
    private UUID id;

    @Column(nullable = false)
    private String title;

    private LocalDate examDate;

    @Column(nullable = false)
    private int dailyMinutes = 20;

    @Column(nullable = false)
    private OffsetDateTime createdAt;

    @Column(columnDefinition = "TEXT")
    private String rawText;

    @Column(nullable = false)
    private String status = "ACTIVE";

    public Course() {
        this.id = UUID.randomUUID();
        this.createdAt = OffsetDateTime.now();
    }

    public Course(String title, LocalDate examDate, int dailyMinutes) {
        this();
        this.title = title;
        this.examDate = examDate;
        this.dailyMinutes = dailyMinutes;
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public LocalDate getExamDate() { return examDate; }
    public void setExamDate(LocalDate examDate) { this.examDate = examDate; }

    public int getDailyMinutes() { return dailyMinutes; }
    public void setDailyMinutes(int dailyMinutes) { this.dailyMinutes = dailyMinutes; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }

    public String getRawText() { return rawText; }
    public void setRawText(String rawText) { this.rawText = rawText; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
}
