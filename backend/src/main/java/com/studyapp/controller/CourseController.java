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
    private final com.studyapp.service.DocumentExtractionService documentExtractionService;
    private final com.studyapp.service.ComputerNetworksCourseSeeder computerNetworksCourseSeeder;

    public CourseController(CourseRepository courseRepository,
                            UnitRepository unitRepository,
                            SectionRepository sectionRepository,
                            LessonRepository lessonRepository,
                            ScheduleService scheduleService,
                            CourseCreationPipelineService pipelineService,
                            com.studyapp.service.DocumentExtractionService documentExtractionService,
                            com.studyapp.service.ComputerNetworksCourseSeeder computerNetworksCourseSeeder) {
        this.courseRepository = courseRepository;
        this.unitRepository = unitRepository;
        this.sectionRepository = sectionRepository;
        this.lessonRepository = lessonRepository;
        this.scheduleService = scheduleService;
        this.pipelineService = pipelineService;
        this.documentExtractionService = documentExtractionService;
        this.computerNetworksCourseSeeder = computerNetworksCourseSeeder;
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

        StringBuilder fullTextBuilder = new StringBuilder();
        int fileIdx = 1;
        for (MultipartFile f : allFiles) {
            if (f != null && !f.isEmpty()) {
                try {
                    var extracted = documentExtractionService.extract(f);
                    String t = extracted.text();
                    if (t != null && !t.isBlank()) {
                        if (fullTextBuilder.length() > 0) fullTextBuilder.append("\n\n");
                        fullTextBuilder.append("=== TÀI LIỆU ").append(fileIdx++).append(": ")
                                .append(f.getOriginalFilename()).append(" ===\n")
                                .append(t.trim());
                    }
                } catch (Exception e) {
                    System.err.println("Lỗi đọc file " + f.getOriginalFilename() + ": " + e.getMessage());
                }
            }
        }

        if (rawText != null && !rawText.isBlank()) {
            if (fullTextBuilder.length() > 0) fullTextBuilder.append("\n\n=== NỘI DUNG VĂN BẢN BỔ SUNG ===\n");
            fullTextBuilder.append(rawText.trim());
        }

        String fullText = fullTextBuilder.toString().trim();
        if (fullText.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Vui lòng chọn ít nhất một file hợp lệ hoặc nhập nội dung."));
        }

        UUID taskId = pipelineService.initTask();
        pipelineService.processCourseCreation(taskId, fullText, title, examDate, dailyMinutes);
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

    @PostMapping("/courses/{id}/relock")
    public ResponseEntity<Map<String, Object>> relockLessons(@PathVariable UUID id) {
        List<com.studyapp.model.Unit> units = unitRepository.findByCourseIdOrderBySortOrderAsc(id);
        int lockedCount = 0;
        boolean foundFirstUnfinished = false;

        for (com.studyapp.model.Unit u : units) {
            List<com.studyapp.model.Section> sections = sectionRepository.findByUnitIdOrderBySortOrderAsc(u.getId());
            for (com.studyapp.model.Section s : sections) {
                List<Lesson> lessons = lessonRepository.findBySectionIdOrderBySortOrderAsc(s.getId());
                for (Lesson l : lessons) {
                    if ("done".equalsIgnoreCase(l.getStatus())) {
                        continue;
                    }
                    if (!foundFirstUnfinished) {
                        l.setStatus("ready");
                        lessonRepository.save(l);
                        foundFirstUnfinished = true;
                    } else {
                        if (!"locked".equalsIgnoreCase(l.getStatus())) {
                            l.setStatus("locked");
                            lessonRepository.save(l);
                            lockedCount++;
                        }
                    }
                }
            }
        }
        return ResponseEntity.ok(Map.of("message", "Đã bật chế độ học tuần tự (khóa các bài học chưa tới)", "lockedCount", lockedCount));
    }

    @PostMapping("/courses/seed-networking")
    public ResponseEntity<Map<String, Object>> seedNetworkingCourse(
            @RequestParam(value = "force", defaultValue = "false") boolean force
    ) {
        try {
            Course c = computerNetworksCourseSeeder.seedCourse(force);
            return ResponseEntity.ok(Map.of(
                    "message", "Đã nạp thành công giáo trình Mạng Máy Tính chuẩn",
                    "courseId", c.getId(),
                    "title", c.getTitle()
            ));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of(
                    "error", "Không thể nạp giáo trình: " + e.getMessage()
            ));
        }
    }

    @DeleteMapping("/courses/{id}")
    public ResponseEntity<Map<String, String>> deleteCourse(@PathVariable UUID id) {
        pipelineService.deleteCourse(id);
        return ResponseEntity.ok(Map.of("message", "Đã xóa môn học thành công"));
    }
}
