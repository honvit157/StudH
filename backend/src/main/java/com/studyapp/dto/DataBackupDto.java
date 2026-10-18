package com.studyapp.dto;

import com.studyapp.model.*;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

public class DataBackupDto {
    private String version = "1.0";
    private OffsetDateTime exportedAt = OffsetDateTime.now();
    private Profile profile;
    private List<Course> courses = new ArrayList<>();
    private List<Unit> units = new ArrayList<>();
    private List<Section> sections = new ArrayList<>();
    private List<Lesson> lessons = new ArrayList<>();
    private List<Item> items = new ArrayList<>();
    private List<ItemState> itemStates = new ArrayList<>();
    private List<ReviewLog> reviewLogs = new ArrayList<>();

    public DataBackupDto() {}

    public String getVersion() { return version; }
    public void setVersion(String version) { this.version = version; }

    public OffsetDateTime getExportedAt() { return exportedAt; }
    public void setExportedAt(OffsetDateTime exportedAt) { this.exportedAt = exportedAt; }

    public Profile getProfile() { return profile; }
    public void setProfile(Profile profile) { this.profile = profile; }

    public List<Course> getCourses() { return courses; }
    public void setCourses(List<Course> courses) { this.courses = courses; }

    public List<Unit> getUnits() { return units; }
    public void setUnits(List<Unit> units) { this.units = units; }

    public List<Section> getSections() { return sections; }
    public void setSections(List<Section> sections) { this.sections = sections; }

    public List<Lesson> getLessons() { return lessons; }
    public void setLessons(List<Lesson> lessons) { this.lessons = lessons; }

    public List<Item> getItems() { return items; }
    public void setItems(List<Item> items) { this.items = items; }

    public List<ItemState> getItemStates() { return itemStates; }
    public void setItemStates(List<ItemState> itemStates) { this.itemStates = itemStates; }

    public List<ReviewLog> getReviewLogs() { return reviewLogs; }
    public void setReviewLogs(List<ReviewLog> reviewLogs) { this.reviewLogs = reviewLogs; }
}
