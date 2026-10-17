package com.studyapp.controller;

import com.studyapp.dto.PathResponse;
import com.studyapp.dto.ScheduleResponse;
import com.studyapp.model.Course;
import com.studyapp.repository.CourseRepository;
import com.studyapp.service.ScheduleService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api")
public class CourseController {

    private final CourseRepository courseRepository;
    private final ScheduleService scheduleService;

    public CourseController(CourseRepository courseRepository, ScheduleService scheduleService) {
        this.courseRepository = courseRepository;
        this.scheduleService = scheduleService;
    }

    @GetMapping("/courses")
    public ResponseEntity<List<Course>> getCourses() {
        return ResponseEntity.ok(courseRepository.findAllByOrderByCreatedAtDesc());
    }

    @GetMapping("/courses/{id}/path")
    public ResponseEntity<PathResponse> getLearningPath(@PathVariable UUID id) {
        PathResponse path = scheduleService.getLearningPath(id);
        return ResponseEntity.ok(path);
    }

    @GetMapping("/schedule")
    public ResponseEntity<ScheduleResponse> getSchedule() {
        List<Course> courses = courseRepository.findAllByOrderByCreatedAtDesc();
        if (courses.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        ScheduleResponse schedule = scheduleService.getSchedule(courses.get(0).getId());
        return ResponseEntity.ok(schedule);
    }

    @PostMapping("/courses/{id}/reschedule")
    public ResponseEntity<Void> reschedule(@PathVariable UUID id) {
        scheduleService.autoScheduleCourse(id);
        return ResponseEntity.ok().build();
    }
}
