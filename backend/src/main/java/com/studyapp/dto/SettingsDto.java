package com.studyapp.dto;

import java.time.LocalDate;
import java.util.UUID;

public class SettingsDto {
    private String id = "default";
    private int xp;
    private int streak;
    private int bestStreak;
    private int dailyGoalXp;
    private String timezone;
    private boolean soundEnabled;
    private String theme;
    private int dailyMinutes = 20;
    private LocalDate examDate;
    private UUID activeCourseId;
    private String activeCourseTitle;

    public SettingsDto() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public int getXp() { return xp; }
    public void setXp(int xp) { this.xp = xp; }

    public int getStreak() { return streak; }
    public void setStreak(int streak) { this.streak = streak; }

    public int getBestStreak() { return bestStreak; }
    public void setBestStreak(int bestStreak) { this.bestStreak = bestStreak; }

    public int getDailyGoalXp() { return dailyGoalXp; }
    public void setDailyGoalXp(int dailyGoalXp) { this.dailyGoalXp = dailyGoalXp; }

    public String getTimezone() { return timezone; }
    public void setTimezone(String timezone) { this.timezone = timezone; }

    public boolean isSoundEnabled() { return soundEnabled; }
    public void setSoundEnabled(boolean soundEnabled) { this.soundEnabled = soundEnabled; }

    public String getTheme() { return theme; }
    public void setTheme(String theme) { this.theme = theme; }

    public int getDailyMinutes() { return dailyMinutes; }
    public void setDailyMinutes(int dailyMinutes) { this.dailyMinutes = dailyMinutes; }

    public LocalDate getExamDate() { return examDate; }
    public void setExamDate(LocalDate examDate) { this.examDate = examDate; }

    public UUID getActiveCourseId() { return activeCourseId; }
    public void setActiveCourseId(UUID activeCourseId) { this.activeCourseId = activeCourseId; }

    public String getActiveCourseTitle() { return activeCourseTitle; }
    public void setActiveCourseTitle(String activeCourseTitle) { this.activeCourseTitle = activeCourseTitle; }
}
