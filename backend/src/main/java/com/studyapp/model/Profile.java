package com.studyapp.model;

import jakarta.persistence.*;
import java.time.LocalDate;

@Entity
@Table(name = "profiles")
public class Profile {
    @Id
    private String id = "default";

    @Column(nullable = false)
    private int xp = 0;

    @Column(nullable = false)
    private int streak = 0;

    @Column(nullable = false)
    private int bestStreak = 0;

    private LocalDate lastActiveDate;

    @Column(nullable = false)
    private int dailyGoalXp = 20;

    @Column(nullable = false)
    private int xpToday = 0;

    @Column(nullable = false)
    private String timezone = "Asia/Ho_Chi_Minh";

    @Column(name = "sound_enabled")
    private Boolean soundEnabled = true;

    @Column(name = "theme")
    private String theme = "system";

    @Column(name = "gemini_api_key")
    private String geminiApiKey;

    public Profile() {}

    public Profile(String id) {
        this.id = id;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public int getXp() { return xp; }
    public void setXp(int xp) { this.xp = xp; }

    public int getStreak() { return streak; }
    public void setStreak(int streak) { this.streak = streak; }

    public int getBestStreak() { return bestStreak; }
    public void setBestStreak(int bestStreak) { this.bestStreak = bestStreak; }

    public LocalDate getLastActiveDate() { return lastActiveDate; }
    public void setLastActiveDate(LocalDate lastActiveDate) { this.lastActiveDate = lastActiveDate; }

    public int getDailyGoalXp() { return dailyGoalXp; }
    public void setDailyGoalXp(int dailyGoalXp) { this.dailyGoalXp = dailyGoalXp; }

    public int getXpToday() { return xpToday; }
    public void setXpToday(int xpToday) { this.xpToday = xpToday; }

    public String getTimezone() { return timezone; }
    public void setTimezone(String timezone) { this.timezone = timezone; }

    public boolean isSoundEnabled() { return soundEnabled == null || soundEnabled; }
    public void setSoundEnabled(Boolean soundEnabled) { this.soundEnabled = soundEnabled != null ? soundEnabled : true; }

    public String getTheme() { return theme != null ? theme : "system"; }
    public void setTheme(String theme) { this.theme = theme != null ? theme : "system"; }

    public String getGeminiApiKey() { return geminiApiKey; }
    public void setGeminiApiKey(String geminiApiKey) { this.geminiApiKey = geminiApiKey; }
}
