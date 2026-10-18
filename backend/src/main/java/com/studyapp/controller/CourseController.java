package com.studyapp.controller;

import com.studyapp.dto.PathResponse;
import com.studyapp.dto.ScheduleResponse;
import com.studyapp.dto.TaskStatusDto;
import com.studyapp.model.Course;
import com.studyapp.model.Item;
import com.studyapp.model.Lesson;
import com.studyapp.repository.CourseRepository;
import com.studyapp.repository.LessonRepository;
import com.studyapp.repository.SectionRepository;
import com.studyapp.repository.UnitRepository;
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
    private final UnitRepository unitRepository;
    private final SectionRepository sectionRepository;
    private final LessonRepository lessonRepository;
    private final ScheduleService scheduleService;
    private final CourseCreationPipelineService pipelineService;

    public CourseController(CourseRepository courseRepository,
                            UnitRepository unitRepository,
                            SectionRepository sectionRepository,
                            LessonRepository lessonRepository,
                            ScheduleService scheduleService,
                            CourseCreationPipelineService pipelineService) {
        this.courseRepository = courseRepository;
        this.unitRepository = unitRepository;
        this.sectionRepository = sectionRepository;
        this.lessonRepository = lessonRepository;
        this.scheduleService = scheduleService;
        this.pipelineService = pipelineService;
    }

    @GetMapping("/courses")
    public ResponseEntity<List<Course>> getCourses() {
        return ResponseEntity.ok(courseRepository.findAllByOrderByCreatedAtDesc());
    }

    @PostMapping(value = "/courses", consumes = {"multipart/form-data"})
    public ResponseEntity<Map<String, Object>> createCourse(
            @RequestParam(value = "files", required = false) List<MultipartFile> files,
            @RequestParam(value = "file", required = false) MultipartFile file,
            @RequestParam(value = "rawText", required = false) String rawText,
            @RequestParam("title") String title,
            @RequestParam(value = "examDate", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate examDate,
            @RequestParam(value = "dailyMinutes", defaultValue = "20") int dailyMinutes
    ) {
        List<MultipartFile> allFiles = new java.util.ArrayList<>();
        if (files != null) {
            allFiles.addAll(files);
        }
        if (file != null && !allFiles.contains(file)) {
            allFiles.add(file);
        }
        UUID taskId = pipelineService.initTask();
        pipelineService.processCourseCreation(taskId, allFiles, rawText, title, examDate, dailyMinutes);
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

    @PostMapping("/lessons/{lessonId}/unlock")
    public ResponseEntity<Map<String, String>> unlockLesson(@PathVariable UUID lessonId) {
        Lesson lesson = lessonRepository.findById(lessonId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy bài học"));
        lesson.setStatus("ready");
        lessonRepository.save(lesson);
        return ResponseEntity.ok(Map.of("message", "Đã mở khóa bài học thành công", "status", "ready"));
    }

    @PostMapping("/courses/{id}/unlock-all")
    public ResponseEntity<Map<String, Object>> unlockAllLessons(@PathVariable UUID id) {
        List<com.studyapp.model.Unit> units = unitRepository.findByCourseIdOrderBySortOrderAsc(id);
        int unlockedCount = 0;
        for (com.studyapp.model.Unit u : units) {
            List<com.studyapp.model.Section> sections = sectionRepository.findByUnitIdOrderBySortOrderAsc(u.getId());
            for (com.studyapp.model.Section s : sections) {
                List<Lesson> lessons = lessonRepository.findBySectionIdOrderBySortOrderAsc(s.getId());
                for (Lesson l : lessons) {
                    if ("locked".equalsIgnoreCase(l.getStatus())) {
                        l.setStatus("ready");
                        lessonRepository.save(l);
                        unlockedCount++;
                    }
                }
            }
        }
        return ResponseEntity.ok(Map.of("message", "Đã mở khóa toàn bộ lộ trình", "unlockedCount", unlockedCount));
    }

    @DeleteMapping("/courses/{id}")
    public ResponseEntity<Map<String, String>> deleteCourse(@PathVariable UUID id) {
        pipelineService.deleteCourse(id);
        return ResponseEntity.ok(Map.of("message", "Đã xóa môn học thành công"));
    }
}
