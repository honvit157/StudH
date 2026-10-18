package com.studyapp.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.studyapp.dto.TaskStatusDto;
import com.studyapp.model.*;
import com.studyapp.repository.*;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class CourseCreationPipelineService {

    private final Map<UUID, TaskStatusDto> taskMap = new ConcurrentHashMap<>();

    private final DocumentExtractionService documentExtractionService;
    private final AiService aiService;
    private final CourseRepository courseRepository;
    private final UnitRepository unitRepository;
    private final SectionRepository sectionRepository;
    private final LessonRepository lessonRepository;
    private final ItemRepository itemRepository;
    private final ItemStateRepository itemStateRepository;
    private final ScheduleService scheduleService;
    private final ObjectMapper objectMapper;

    public CourseCreationPipelineService(DocumentExtractionService documentExtractionService,
                                         AiService aiService,
                                         CourseRepository courseRepository,
                                         UnitRepository unitRepository,
                                         SectionRepository sectionRepository,
                                         LessonRepository lessonRepository,
                                         ItemRepository itemRepository,
                                         ItemStateRepository itemStateRepository,
                                         ScheduleService scheduleService,
                                         ObjectMapper objectMapper) {
        this.documentExtractionService = documentExtractionService;
        this.aiService = aiService;
        this.courseRepository = courseRepository;
        this.unitRepository = unitRepository;
        this.sectionRepository = sectionRepository;
        this.lessonRepository = lessonRepository;
        this.itemRepository = itemRepository;
        this.itemStateRepository = itemStateRepository;
        this.scheduleService = scheduleService;
        this.objectMapper = objectMapper;
    }

    public UUID initTask() {
        UUID taskId = UUID.randomUUID();
        taskMap.put(taskId, new TaskStatusDto(taskId, "PROCESSING", 10, "Bắt đầu tiếp nhận tài liệu...", null, null));
        return taskId;
    }

    public TaskStatusDto getTaskStatus(UUID taskId) {
        return taskMap.getOrDefault(taskId, new TaskStatusDto(taskId, "FAILED", 0, "Không tìm thấy tác vụ", null, "Not found"));
    }

    @Async
    public void processCourseCreation(UUID taskId,
                                      String fullText,
                                      String title,
                                      LocalDate examDate,
                                      int dailyMinutes) {
        try {
            updateTask(taskId, 35, "AI đang phân tích tài liệu và cấu trúc mục lục...");

            String courseTitle = (title != null && !title.isBlank()) ? title : "Khóa học tài liệu mới";
            Course course = new Course(courseTitle, examDate, dailyMinutes);
            course.setRawText(fullText.length() > 5000000 ? fullText.substring(0, 5000000) : fullText);
            courseRepository.save(course);

            // Gọi AI tạo mục lục
            AiService.GeneratedOutline outline = aiService.generateOutline(fullText);

            updateTask(taskId, 70, "Đang lưu cấu trúc bài học và lộ trình...");

            int unitOrder = 1;
            Lesson firstLesson = null;

            for (AiService.GeneratedUnit u : outline.units()) {
                Unit unit = new Unit(course.getId(), unitOrder++, u.title());
                unitRepository.save(unit);

                int secOrder = 1;
                for (AiService.GeneratedSection s : u.sections()) {
                    Section sec = new Section(unit.getId(), secOrder++, s.title());
                    sectionRepository.save(sec);

                    int lesOrder = 1;
                    for (AiService.GeneratedLesson l : s.lessons()) {
                        Lesson lesson = new Lesson(sec.getId(), lesOrder++, l.title(), l.sourceText());
                        lesson.setStatus("locked");
                        lessonRepository.save(lesson);

                        if (firstLesson == null) {
                            firstLesson = lesson;
                        }
                    }
                }
            }

            updateTask(taskId, 85, "Đang tính toán thuật toán xếp lịch học ngắt quãng...");
            scheduleService.autoScheduleCourse(course.getId());

            // Tự động sinh sẵn câu hỏi cho các bài học đã mở khóa để người dùng có thể học được ngay
            List<Unit> savedUnits = unitRepository.findByCourseIdOrderBySortOrderAsc(course.getId());
            List<Lesson> readyLessons = new ArrayList<>();
            for (Unit u : savedUnits) {
                List<Section> sections = sectionRepository.findByUnitIdOrderBySortOrderAsc(u.getId());
                for (Section s : sections) {
                    List<Lesson> lessons = lessonRepository.findBySectionIdOrderBySortOrderAsc(s.getId());
                    for (Lesson l : lessons) {
                        if ("ready".equalsIgnoreCase(l.getStatus())) {
                            readyLessons.add(l);
                        }
                    }
                }
            }

            if (readyLessons.isEmpty() && firstLesson != null) {
                readyLessons.add(firstLesson);
            }

            int count = 1;
            for (Lesson l : readyLessons) {
                if (count > 5) break;
                updateTask(taskId, Math.min(98, 85 + (count * 2)), "Đang sinh câu hỏi cho bài " + count + "...");
                try {
                    generateItemsForLesson(l.getId());
                } catch (Exception ex) {
                    System.err.println("Could not pre-generate items for lesson " + l.getId() + ": " + ex.getMessage());
                }
                count++;
            }

            taskMap.put(taskId, new TaskStatusDto(taskId, "COMPLETED", 100, "Tạo khóa học thành công!", course.getId(), null));

        } catch (Exception e) {
            e.printStackTrace();
            taskMap.put(taskId, new TaskStatusDto(taskId, "FAILED", 0, "Lỗi khi xử lý tài liệu: " + e.getMessage(), null, e.getMessage()));
        }
    }

    /**
     * Cơ chế Lazy Generation: Sinh Item theo nhu cầu cho một bài học.
     */
    @Transactional
    public List<Item> generateItemsForLesson(UUID lessonId) throws Exception {
        Lesson lesson = lessonRepository.findById(lessonId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy bài học"));

        List<Item> existingItems = itemRepository.findByLessonId(lessonId);
        if (!existingItems.isEmpty()) {
            return existingItems;
        }

        String sourceText = lesson.getSourceText() != null ? lesson.getSourceText() : lesson.getTitle();
        List<AiService.GeneratedItem> aiItems = aiService.generateLessonItems(lesson.getTitle(), sourceText);

        for (AiService.GeneratedItem aiItem : aiItems) {
            List<String> cleanDistractors = new ArrayList<>();
            for (String d : aiItem.distractors()) {
                cleanDistractors.add(AiService.cleanChoiceText(d));
            }

            Item item = new Item(
                    lessonId,
                    aiItem.prompt(),
                    aiItem.intro(),
                    AiService.cleanChoiceText(aiItem.answer()),
                    objectMapper.writeValueAsString(cleanDistractors),
                    AiService.cleanChoiceText(aiItem.explanation()),
                    aiItem.sourceQuote()
            );
            itemRepository.save(item);

            ItemState state = new ItemState(item.getId());
            state.setEase(2.5);
            state.setIntervalDays(0);
            state.setRepetitions(0);
            state.setLapses(0);
            state.setIntroduced(false);
            itemStateRepository.save(state);
        }

        return itemRepository.findByLessonId(lessonId);
    }

    @org.springframework.context.event.EventListener(org.springframework.boot.context.event.ApplicationReadyEvent.class)
    @Transactional
    public void autoRepairExistingData() {
        try {
            // 1. Quét và dọn dẹp các câu hỏi trắc nghiệm rác về ISBN, This, Display hoặc metadata xuất bản
            List<Item> allItems = itemRepository.findAll();
            int deletedJunkCount = 0;
            for (Item item : allItems) {
                String ans = item.getAnswer() != null ? item.getAnswer().trim() : "";
                String prompt = item.getPrompt() != null ? item.getPrompt() : "";

                boolean isJunk = ans.matches("(?i)^(?:ISBN.*|This|Display|Upper Saddle River|Pearson|Marcia Horton|Emma Snider|Keith W\\. Ross|James F\\. Kurose|978-.*)$")
                        || prompt.contains("book was composed")
                        || prompt.contains("font is Berkeley")
                        || prompt.contains("ISBN-13")
                        || prompt.contains("ISBN-10");

                if (isJunk) {
                    itemStateRepository.deleteById(item.getId());
                    itemRepository.delete(item);
                    deletedJunkCount++;
                }
            }
            if (deletedJunkCount > 0) {
                System.out.println("Cleaned " + deletedJunkCount + " junk boilerplate items from database.");
            }

            // 2. Quét và đổi tên các bài học bị đặt tên theo mã thư viện hoặc metadata xuất bản
            List<Lesson> allLessons = lessonRepository.findAll();
            for (Lesson l : allLessons) {
                String title = l.getTitle() != null ? l.getTitle() : "";
                if (!AiService.isAcademicHeading(title)) {
                    l.setTitle("Bài " + l.getSortOrder() + ": Kiến thức chuyên đề " + l.getSortOrder());
                    lessonRepository.save(l);
                }
            }
        } catch (Exception e) {
            System.err.println("Error during safe repair: " + e.getMessage());
        }
    }

    @Transactional
    public void deleteCourse(UUID courseId) {
        List<Unit> units = unitRepository.findByCourseIdOrderBySortOrderAsc(courseId);
        for (Unit u : units) {
            List<Section> sections = sectionRepository.findByUnitIdOrderBySortOrderAsc(u.getId());
            for (Section s : sections) {
                List<Lesson> lessons = lessonRepository.findBySectionIdOrderBySortOrderAsc(s.getId());
                for (Lesson l : lessons) {
                    List<Item> items = itemRepository.findByLessonId(l.getId());
                    for (Item item : items) {
                        itemStateRepository.deleteById(item.getId());
                    }
                    itemRepository.deleteAll(items);
                }
                lessonRepository.deleteAll(lessons);
            }
            sectionRepository.deleteAll(sections);
        }
        unitRepository.deleteAll(units);
        courseRepository.deleteById(courseId);
    }

    private void updateTask(UUID taskId, int progress, String message) {
        taskMap.put(taskId, "PROCESSING".equals(taskMap.get(taskId) != null ? taskMap.get(taskId).status() : "PROCESSING") ?
                new TaskStatusDto(taskId, "PROCESSING", progress, message, null, null) : taskMap.get(taskId));
    }
}
