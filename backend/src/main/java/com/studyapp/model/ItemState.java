package com.studyapp.model;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "item_states")
public class ItemState {
    @Id
    private UUID itemId;

    @Column(nullable = false)
    private double ease = 2.5;

    @Column(nullable = false)
    private int intervalDays = 0;

    @Column(nullable = false)
    private int repetitions = 0;

    @Column(nullable = false)
    private int lapses = 0;

    private OffsetDateTime dueAt;

    private String lastResult;

    @Column(nullable = false)
    private boolean introduced = false;

    public ItemState() {}

    public ItemState(UUID itemId) {
        this.itemId = itemId;
        this.ease = 2.5;
        this.intervalDays = 0;
        this.repetitions = 0;
        this.lapses = 0;
        this.introduced = false;
    }

    public UUID getItemId() { return itemId; }
    public void setItemId(UUID itemId) { this.itemId = itemId; }

    public double getEase() { return ease; }
    public void setEase(double ease) { this.ease = ease; }

    public int getIntervalDays() { return intervalDays; }
    public void setIntervalDays(int intervalDays) { this.intervalDays = intervalDays; }

    public int getRepetitions() { return repetitions; }
    public void setRepetitions(int repetitions) { this.repetitions = repetitions; }

    public int getLapses() { return lapses; }
    public void setLapses(int lapses) { this.lapses = lapses; }

    public OffsetDateTime getDueAt() { return dueAt; }
    public void setDueAt(OffsetDateTime dueAt) { this.dueAt = dueAt; }

    public String getLastResult() { return lastResult; }
    public void setLastResult(String lastResult) { this.lastResult = lastResult; }

    public boolean isIntroduced() { return introduced; }
    public void setIntroduced(boolean introduced) { this.introduced = introduced; }
}
