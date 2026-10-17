package com.studyapp.model;

import jakarta.persistence.*;
import java.util.UUID;

@Entity
@Table(name = "sections")
public class Section {
    @Id
    private UUID id;

    @Column(nullable = false)
    private UUID unitId;

    @Column(nullable = false)
    private int sortOrder = 0;

    @Column(nullable = false)
    private String title;

    public Section() {
        this.id = UUID.randomUUID();
    }

    public Section(UUID unitId, int sortOrder, String title) {
        this();
        this.unitId = unitId;
        this.sortOrder = sortOrder;
        this.title = title;
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getUnitId() { return unitId; }
    public void setUnitId(UUID unitId) { this.unitId = unitId; }

    public int getSortOrder() { return sortOrder; }
    public void setSortOrder(int sortOrder) { this.sortOrder = sortOrder; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
}
