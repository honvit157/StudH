package com.studyapp.controller;

import com.studyapp.dto.PathResponse;
import com.studyapp.dto.ScheduleResponse;
import com.studyapp.dto.TaskStatusDto;
import com.studyapp.model.Course;
import com.studyapp.model.Item;
import com.studyapp.repository.CourseRepository;
import com.studyapp.service.CourseCreationPipelineService;
import com.studyapp.service.ScheduleService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api")
public class CourseController {

    private final CourseRepository courseRepository;
    private final ScheduleService scheduleService;
    private final CourseCreationPipelineService pipelineService;

    public CourseController(CourseRepository courseRepository,
                            ScheduleService scheduleService,
                            CourseCreationPipelineService pipelineService) {
        this.courseRepository = courseRepository;
        this.scheduleService = scheduleService;
        this.pipelineService = pipelineService;
    }

    @GetMapping("/courses")
    public ResponseEntity<List<Course>> getCourses() {
        return ResponseEntity.ok(courseRepository.findAllByOrderByCreatedAtDesc());
    }

    @PostMapping(value = "/courses", consumes = {"multipart/form-data"})
    public ResponseEntity<Map<String, Object>> createCourse(
            @RequestParam(value = "file", required = false) MultipartFile file,
            @RequestParam(value = "rawText", required = false) String rawText,
            @RequestParam("title") String title,
            @RequestParam(value = "examDate", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate examDate,
            @RequestParam(value = "dailyMinutes", defaultValue = "20") int dailyMinutes
    ) {
        UUID taskId = pipelineService.initTask();
        pipelineService.processCourseCreation(taskId, file, rawText, title, examDate, dailyMinutes);
        return ResponseEntity.ok(Map.of("taskId", taskId));
    }

    @GetMapping("/tasks/{taskId}")
    public ResponseEntity<TaskStatusDto> getTaskStatus(@PathVariable UUID taskId) {
        return ResponseEntity.ok(pipelineService.getTaskStatus(taskId));
    }

    @PostMapping("/lessons/{lessonId}/generate")
    public ResponseEntity<List<Item>> generateLessonItems(@PathVariable UUID lessonId) throws Exception {
        List<Item> items = pipelineService.generateItemsForLesson(lessonId);
        return ResponseEntity.ok(items);
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
