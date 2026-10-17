package com.studyapp.model;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "review_logs")
public class ReviewLog {
    @Id
    private UUID id;

    @Column(nullable = false)
    private UUID itemId;

    @Column(nullable = false)
    private boolean correct;

    @Column(nullable = false)
    private long responseMs;

    @Column(nullable = false)
    private OffsetDateTime at;

    public ReviewLog() {
        this.id = UUID.randomUUID();
        this.at = OffsetDateTime.now();
    }

    public ReviewLog(UUID itemId, boolean correct, long responseMs) {
        this();
        this.itemId = itemId;
        this.correct = correct;
        this.responseMs = responseMs;
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getItemId() { return itemId; }
    public void setItemId(UUID itemId) { this.itemId = itemId; }

    public boolean isCorrect() { return correct; }
    public void setCorrect(boolean correct) { this.correct = correct; }

    public long getResponseMs() { return responseMs; }
    public void setResponseMs(long responseMs) { this.responseMs = responseMs; }

    public OffsetDateTime getAt() { return at; }
    public void setAt(OffsetDateTime at) { this.at = at; }
}
