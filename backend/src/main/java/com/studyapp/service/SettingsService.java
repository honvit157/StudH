package com.studyapp.service;

import com.studyapp.dto.SettingsDto;
import com.studyapp.dto.UpdateSettingsRequest;
import com.studyapp.model.Course;
import com.studyapp.model.Profile;
import com.studyapp.repository.CourseRepository;
import com.studyapp.repository.ProfileRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class SettingsService {

    private final ProfileRepository profileRepository;
    private final CourseRepository courseRepository;

    public SettingsService(ProfileRepository profileRepository, CourseRepository courseRepository) {
        this.profileRepository = profileRepository;
        this.courseRepository = courseRepository;
    }

    public SettingsDto getSettings() {
        Profile profile = profileRepository.findById("default").orElseGet(() -> {
            Profile p = new Profile("default");
            return profileRepository.save(p);
        });

        List<Course> courses = courseRepository.findAll();
        Course activeCourse = courses.stream()
                .filter(c -> "ACTIVE".equalsIgnoreCase(c.getStatus()))
                .findFirst()
                .orElse(courses.isEmpty() ? null : courses.get(0));

        SettingsDto dto = new SettingsDto();
        dto.setId(profile.getId());
        dto.setXp(profile.getXp());
        dto.setStreak(profile.getStreak());
        dto.setBestStreak(profile.getBestStreak());
        dto.setDailyGoalXp(profile.getDailyGoalXp());
        dto.setTimezone(profile.getTimezone());
        dto.setSoundEnabled(profile.isSoundEnabled());
        dto.setTheme(profile.getTheme());

        if (activeCourse != null) {
            dto.setActiveCourseId(activeCourse.getId());
            dto.setActiveCourseTitle(activeCourse.getTitle());
            dto.setDailyMinutes(activeCourse.getDailyMinutes());
            dto.setExamDate(activeCourse.getExamDate());
        }

        return dto;
    }

    @Transactional
    public SettingsDto updateSettings(UpdateSettingsRequest request) {
        Profile profile = profileRepository.findById("default").orElseGet(() -> new Profile("default"));

        if (request.getDailyGoalXp() != null && request.getDailyGoalXp() > 0) {
            profile.setDailyGoalXp(request.getDailyGoalXp());
        }
        if (request.getTimezone() != null && !request.getTimezone().isBlank()) {
            profile.setTimezone(request.getTimezone());
        }
        if (request.getSoundEnabled() != null) {
            profile.setSoundEnabled(request.getSoundEnabled());
        }
        if (request.getTheme() != null && !request.getTheme().isBlank()) {
            profile.setTheme(request.getTheme());
        }
        profileRepository.save(profile);

        List<Course> courses = courseRepository.findAll();
        Course activeCourse = courses.stream()
                .filter(c -> "ACTIVE".equalsIgnoreCase(c.getStatus()))
                .findFirst()
                .orElse(courses.isEmpty() ? null : courses.get(0));

        if (activeCourse != null) {
            boolean courseChanged = false;
            if (request.getDailyMinutes() != null && request.getDailyMinutes() > 0) {
                activeCourse.setDailyMinutes(request.getDailyMinutes());
                courseChanged = true;
            }
            if (request.getExamDate() != null) {
                activeCourse.setExamDate(request.getExamDate());
                courseChanged = true;
            }
            if (courseChanged) {
                courseRepository.save(activeCourse);
            }
        }

        return getSettings();
    }
}
