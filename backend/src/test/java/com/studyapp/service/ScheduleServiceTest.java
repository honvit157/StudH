package com.studyapp.service;

import com.studyapp.dto.PathResponse;
import com.studyapp.dto.ScheduleResponse;
import com.studyapp.model.*;
import com.studyapp.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
public class ScheduleServiceTest {

    @Autowired
    private ScheduleService scheduleService;

    @Autowired
    private CourseRepository courseRepository;

    @Autowired
    private UnitRepository unitRepository;

    @Autowired
    private SectionRepository sectionRepository;

    @Autowired
    private LessonRepository lessonRepository;

    @Autowired
    private ItemRepository itemRepository;

    @Autowired
    private ItemStateRepository itemStateRepository;

    private Course course;

    @BeforeEach
    void setUp() {
        itemStateRepository.deleteAll();
        itemRepository.deleteAll();
        lessonRepository.deleteAll();
        sectionRepository.deleteAll();
        unitRepository.deleteAll();
        courseRepository.deleteAll();

        // Khóa học thi sau 20 ngày -> N = 3 ngày cuối chỉ ôn tập
        course = new Course("Khóa học thuật toán", LocalDate.now().plusDays(20), 20);
        courseRepository.save(course);

        Unit unit = new Unit(course.getId(), 1, "Chương 1");
        unitRepository.save(unit);

        Section section = new Section(unit.getId(), 1, "Chủ đề 1");
        sectionRepository.save(section);

        // Tạo 6 bài học
        for (int i = 1; i <= 6; i++) {
            Lesson lesson = new Lesson(section.getId(), i, "Bài " + i, "Nội dung bài " + i);
            lesson.setStatus("locked");
            lessonRepository.save(lesson);
        }
    }

    @Test
    @DisplayName("Thuật toán tự động xếp lịch phân bổ bài học và mở khóa bài hôm nay")
    void testAutoScheduleCourse() {
        scheduleService.autoScheduleCourse(course.getId());

        PathResponse path = scheduleService.getLearningPath(course.getId());
        assertNotNull(path);
        assertEquals(1, path.units().size());

        var lessons = path.units().get(0).sections().get(0).lessons();
        assertEquals(6, lessons.size());

        // Kiểm tra bài học đầu tiên có ngày học là hôm nay và đã được mở khóa 'ready'
        assertEquals(LocalDate.now(), lessons.get(0).scheduledDate());
        assertEquals("ready", lessons.get(0).status());
    }

    @Test
    @DisplayName("Lấy kế hoạch học tập theo ngày và kiểm tra các ngày ôn tập cuối khóa")
    void testGetScheduleRevisionDays() {
        scheduleService.autoScheduleCourse(course.getId());

        ScheduleResponse schedule = scheduleService.getSchedule(course.getId());
        assertNotNull(schedule);
        assertTrue(schedule.scheduleDays().size() >= 20);

        // Ngày thi là ngày cuối cùng, phải được đánh dấu là ngày ôn tập
        var lastDay = schedule.scheduleDays().get(schedule.scheduleDays().size() - 1);
        assertTrue(lastDay.isRevisionOnlyDay(), "Ngày thi và các ngày sát ngày thi phải là ngày ôn tập");
    }

    @Test
    @DisplayName("Cấu trúc đường học Unit -> Section -> Lesson hiển thị phân cấp chính xác")
    void testLearningPathHierarchy() {
        PathResponse path = scheduleService.getLearningPath(course.getId());
        assertEquals("Khóa học thuật toán", path.courseTitle());
        assertEquals("Chương 1", path.units().get(0).title());
        assertEquals("Chủ đề 1", path.units().get(0).sections().get(0).title());
        assertEquals(6, path.units().get(0).sections().get(0).lessons().size());
    }
}
