package com.studyapp.model;

import jakarta.persistence.*;
import java.util.UUID;

@Entity
@Table(name = "units")
public class Unit {
    @Id
    private UUID id;

    @Column(nullable = false)
    private UUID courseId;

    @Column(nullable = false)
    private int sortOrder = 0;

    @Column(nullable = false)
    private String title;

    public Unit() {
        this.id = UUID.randomUUID();
    }

    public Unit(UUID courseId, int sortOrder, String title) {
        this();
        this.courseId = courseId;
        this.sortOrder = sortOrder;
        this.title = title;
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getCourseId() { return courseId; }
    public void setCourseId(UUID courseId) { this.courseId = courseId; }

    public int getSortOrder() { return sortOrder; }
    public void setSortOrder(int sortOrder) { this.sortOrder = sortOrder; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
}
