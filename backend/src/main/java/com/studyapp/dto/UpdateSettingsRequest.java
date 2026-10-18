package com.studyapp.dto;

import java.time.LocalDate;

public class UpdateSettingsRequest {
    private Integer dailyGoalXp;
    private String timezone;
    private Boolean soundEnabled;
    private String theme;
    private Integer dailyMinutes;
    private LocalDate examDate;

    public UpdateSettingsRequest() {}

    public Integer getDailyGoalXp() { return dailyGoalXp; }
    public void setDailyGoalXp(Integer dailyGoalXp) { this.dailyGoalXp = dailyGoalXp; }

    public String getTimezone() { return timezone; }
    public void setTimezone(String timezone) { this.timezone = timezone; }

    public Boolean getSoundEnabled() { return soundEnabled; }
    public void setSoundEnabled(Boolean soundEnabled) { this.soundEnabled = soundEnabled; }

    public String getTheme() { return theme; }
    public void setTheme(String theme) { this.theme = theme; }

    public Integer getDailyMinutes() { return dailyMinutes; }
    public void setDailyMinutes(Integer dailyMinutes) { this.dailyMinutes = dailyMinutes; }

    public LocalDate getExamDate() { return examDate; }
    public void setExamDate(LocalDate examDate) { this.examDate = examDate; }

    private String geminiApiKey;
    public String getGeminiApiKey() { return geminiApiKey; }
    public void setGeminiApiKey(String geminiApiKey) { this.geminiApiKey = geminiApiKey; }
}
