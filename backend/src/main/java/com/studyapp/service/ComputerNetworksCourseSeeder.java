package com.studyapp.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.studyapp.model.*;
import com.studyapp.repository.*;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.InputStream;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.*;

@Service
@Order(1)
public class ComputerNetworksCourseSeeder implements CommandLineRunner {

    private final CourseRepository courseRepository;
    private final UnitRepository unitRepository;
    private final SectionRepository sectionRepository;
    private final LessonRepository lessonRepository;
    private final ItemRepository itemRepository;
    private final ItemStateRepository itemStateRepository;
    private final ProfileRepository profileRepository;
    private final ObjectMapper objectMapper;

    public ComputerNetworksCourseSeeder(
            CourseRepository courseRepository,
            UnitRepository unitRepository,
            SectionRepository sectionRepository,
            LessonRepository lessonRepository,
            ItemRepository itemRepository,
            ItemStateRepository itemStateRepository,
            ProfileRepository profileRepository,
            ObjectMapper objectMapper) {
        this.courseRepository = courseRepository;
        this.unitRepository = unitRepository;
        this.sectionRepository = sectionRepository;
        this.lessonRepository = lessonRepository;
        this.itemRepository = itemRepository;
        this.itemStateRepository = itemStateRepository;
        this.profileRepository = profileRepository;
        this.objectMapper = objectMapper;
    }

    @Override
    public void run(String... args) {
        try {
            seedCourse(false);
        } catch (Exception e) {
            System.err.println("Lỗi trong quá trình khởi tạo môn Mạng Máy Tính: " + e.getMessage());
            e.printStackTrace();
        }
    }

    @Transactional
    public Course seedCourse(boolean force) throws Exception {
        String courseTitle = "Mạng Máy Tính - Toàn Diện & Luyện Thi Eduso";

        List<Course> existingList = courseRepository.findAll();
        Course targetCourse = null;
        for (Course c : existingList) {
            if (courseTitle.equalsIgnoreCase(c.getTitle()) || "Mạng Máy Tính".equalsIgnoreCase(c.getTitle())) {
                targetCourse = c;
                break;
            }
        }

        if (targetCourse != null && !force) {
            System.out.println("Môn học '" + courseTitle + "' đã tồn tại trong database (ID: " + targetCourse.getId() + ").");
            cleanLegacyMockCourses(targetCourse.getId());
            return targetCourse;
        }

        if (targetCourse != null && force) {
            System.out.println("Force re-seeding môn học '" + courseTitle + "'. Xóa bản ghi cũ...");
            deleteCourseCascade(targetCourse.getId());
        }

        // Đọc dữ liệu giáo trình chuẩn từ JSON
        InputStream is = getClass().getResourceAsStream("/data/networking_course_seed.json");
        if (is == null) {
            throw new IllegalStateException("Không tìm thấy tệp tài nguyên /data/networking_course_seed.json");
        }

        JsonNode root = objectMapper.readTree(is);
        String title = root.has("title") ? root.get("title").asText() : courseTitle;
        String description = root.has("description") ? root.get("description").asText() : "";
        int dailyMinutes = root.has("dailyMinutes") ? root.get("dailyMinutes").asInt(20) : 20;

        Course course = new Course(title, LocalDate.now().plusDays(30), dailyMinutes);
        course.setRawText(description);
        course.setStatus("ACTIVE");
        course = courseRepository.save(course);

        int totalUnits = 0;
        int totalSections = 0;
        int totalLessons = 0;
        int totalItems = 0;

        if (root.has("units")) {
            for (JsonNode unitNode : root.get("units")) {
                int uSort = unitNode.has("sortOrder") ? unitNode.get("sortOrder").asInt() : ++totalUnits;
                String uTitle = unitNode.has("title") ? unitNode.get("title").asText() : "Chương " + uSort;
                Unit unit = new Unit(course.getId(), uSort, uTitle);
                unit = unitRepository.save(unit);
                totalUnits++;

                if (unitNode.has("sections")) {
                    for (JsonNode secNode : unitNode.get("sections")) {
                        int sSort = secNode.has("sortOrder") ? secNode.get("sortOrder").asInt() : ++totalSections;
                        String sTitle = secNode.has("title") ? secNode.get("title").asText() : "Chuyên đề " + sSort;
                        Section section = new Section(unit.getId(), sSort, sTitle);
                        section = sectionRepository.save(section);
                        totalSections++;

                        if (secNode.has("lessons")) {
                            for (JsonNode lNode : secNode.get("lessons")) {
                                totalLessons++;
                                int lSort = lNode.has("sortOrder") ? lNode.get("sortOrder").asInt() : totalLessons;
                                String lTitle = lNode.has("title") ? lNode.get("title").asText() : "Bài " + lSort;

                                String sourceText;
                                if (lNode.has("overview")) {
                                    Map<String, Object> ovWrap = Map.of("overview", objectMapper.treeToValue(lNode.get("overview"), Object.class));
                                    sourceText = objectMapper.writeValueAsString(ovWrap);
                                } else {
                                    sourceText = lTitle;
                                }

                                Lesson lesson = new Lesson(section.getId(), lSort, lTitle, sourceText);
                                // Bài học đầu tiên của Chương 1 mở khóa sẵn
                                if (totalLessons == 1) {
                                    lesson.setStatus("ready");
                                } else {
                                    lesson.setStatus("locked");
                                }
                                lesson.setScheduledDate(LocalDate.now().plusDays((totalLessons - 1) / 2));
                                lesson = lessonRepository.save(lesson);

                                if (lNode.has("items")) {
                                    for (JsonNode itNode : lNode.get("items")) {
                                        totalItems++;
                                        String prompt = itNode.has("prompt") ? itNode.get("prompt").asText() : "";
                                        String intro = itNode.has("intro") ? itNode.get("intro").asText() : "";
                                        String answer = itNode.has("answer") ? itNode.get("answer").asText() : "";
                                        String explanation = itNode.has("explanation") ? itNode.get("explanation").asText() : "";
                                        String sourceQuote = itNode.has("sourceQuote") ? itNode.get("sourceQuote").asText() : "Giáo trình Mạng máy tính";

                                        List<String> distractors = new ArrayList<>();
                                        if (itNode.has("distractors")) {
                                            for (JsonNode d : itNode.get("distractors")) {
                                                distractors.add(d.asText());
                                            }
                                        }

                                        Item item = new Item(
                                                lesson.getId(),
                                                prompt,
                                                intro,
                                                answer,
                                                objectMapper.writeValueAsString(distractors),
                                                explanation,
                                                sourceQuote
                                        );
                                        item = itemRepository.save(item);

                                        ItemState state = new ItemState(item.getId());
                                        state.setIntroduced(false);
                                        state.setDueAt(OffsetDateTime.now());
                                        itemStateRepository.save(state);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // Cập nhật Profile mặc định
        Profile profile = profileRepository.findById("default").orElseGet(() -> new Profile("default"));
        profile.setDailyGoalXp(20);
        profileRepository.save(profile);

        // Xóa các môn học mock cũ
        cleanLegacyMockCourses(course.getId());

        System.out.println("ĐÃ NẠP THÀNH CÔNG MÔN HỌC MẠNG MÁY TÍNH:");
        System.out.println(" - Chương (Units): " + totalUnits);
        System.out.println(" - Bài học (Lessons): " + totalLessons);
        System.out.println(" - Câu hỏi chuẩn Eduso (Items): " + totalItems);

        return course;
    }

    private void cleanLegacyMockCourses(UUID keepCourseId) {
        List<Course> all = courseRepository.findAll();
        for (Course c : all) {
            if (!c.getId().equals(keepCourseId)) {
                String title = c.getTitle() != null ? c.getTitle().toLowerCase() : "";
                if (title.contains("lập trình web") || title.contains("mang may tinh v") || title.contains("v4") || title.contains("18 tài liệu")) {
                    try {
                        System.out.println("Dọn dẹp khóa học cũ: " + c.getTitle() + " (" + c.getId() + ")");
                        deleteCourseCascade(c.getId());
                    } catch (Exception e) {
                        System.err.println("Không thể xóa khóa học cũ " + c.getId() + ": " + e.getMessage());
                    }
                }
            }
        }
    }

    private void deleteCourseCascade(UUID courseId) {
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
                    lessonRepository.delete(l);
                }
                sectionRepository.delete(s);
            }
            unitRepository.delete(u);
        }
        courseRepository.deleteById(courseId);
    }
}
