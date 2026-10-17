package com.studyapp.service;

import com.studyapp.dto.PathResponse;
import com.studyapp.dto.ScheduleResponse;
import com.studyapp.model.*;
import com.studyapp.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class ScheduleService {

    private final CourseRepository courseRepository;
    private final UnitRepository unitRepository;
    private final SectionRepository sectionRepository;
    private final LessonRepository lessonRepository;
    private final ItemRepository itemRepository;
    private final ItemStateRepository itemStateRepository;

    public ScheduleService(CourseRepository courseRepository,
                           UnitRepository unitRepository,
                           SectionRepository sectionRepository,
                           LessonRepository lessonRepository,
                           ItemRepository itemRepository,
                           ItemStateRepository itemStateRepository) {
        this.courseRepository = courseRepository;
        this.unitRepository = unitRepository;
        this.sectionRepository = sectionRepository;
        this.lessonRepository = lessonRepository;
        this.itemRepository = itemRepository;
        this.itemStateRepository = itemStateRepository;
    }

    /**
     * Thuật toán xếp lịch và dồn lịch học thông minh (Mục 6 SPEC).
     */
    @Transactional
    public void autoScheduleCourse(UUID courseId) {
        Course course = courseRepository.findById(courseId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy khóa học"));

        LocalDate today = LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh"));
        LocalDate examDate = course.getExamDate() != null ? course.getExamDate() : today.plusDays(30);

        long daysUntilExam = ChronoUnit.DAYS.between(today, examDate);
        if (daysUntilExam < 1) daysUntilExam = 1;

        // Số ngày dành riêng ôn tập cuối khóa:
        // N = 3 nếu >= 14 ngày, N = 2 nếu < 14 ngày, N = 0 nếu < 5 ngày
        int N = 0;
        if (daysUntilExam >= 14) {
            N = 3;
        } else if (daysUntilExam >= 5) {
            N = 2;
        }

        int availableStudyDays = (int) Math.max(1, daysUntilExam - N);

        // Lấy toàn bộ bài học chưa hoàn thành
        List<Unit> units = unitRepository.findByCourseIdOrderBySortOrderAsc(courseId);
        List<Lesson> pendingLessons = new ArrayList<>();

        for (Unit unit : units) {
            List<Section> sections = sectionRepository.findByUnitIdOrderBySortOrderAsc(unit.getId());
            for (Section section : sections) {
                List<Lesson> lessons = lessonRepository.findBySectionIdOrderBySortOrderAsc(section.getId());
                for (Lesson lesson : lessons) {
                    if (!"done".equalsIgnoreCase(lesson.getStatus())) {
                        pendingLessons.add(lesson);
                    }
                }
            }
        }

        if (pendingLessons.isEmpty()) return;

        // Số Lesson mới mỗi ngày = ceil(tổng Lesson chưa học / số ngày học)
        int lessonsPerDay = (int) Math.ceil((double) pendingLessons.size() / availableStudyDays);

        int currentDayOffset = 0;
        int countInCurrentDay = 0;

        for (int i = 0; i < pendingLessons.size(); i++) {
            Lesson lesson = pendingLessons.get(i);
            LocalDate assignDate = today.plusDays(currentDayOffset);
            lesson.setScheduledDate(assignDate);

            // Nếu là bài học hôm nay hoặc ngày trước thì mở khóa
            if (!assignDate.isAfter(today) && "locked".equalsIgnoreCase(lesson.getStatus())) {
                lesson.setStatus("ready");
            }

            countInCurrentDay++;
            if (countInCurrentDay >= lessonsPerDay && currentDayOffset < availableStudyDays - 1) {
                currentDayOffset++;
                countInCurrentDay = 0;
            }
        }

        lessonRepository.saveAll(pendingLessons);
    }

    /**
     * Lấy kế hoạch học tập theo từng ngày đến ngày thi (Mục 6 & 13 SPEC).
     */
    @Transactional(readOnly = true)
    public ScheduleResponse getSchedule(UUID courseId) {
        Course course = courseRepository.findById(courseId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy khóa học"));

        LocalDate today = LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh"));
        LocalDate examDate = course.getExamDate() != null ? course.getExamDate() : today.plusDays(30);

        long daysUntilExam = Math.max(1, ChronoUnit.DAYS.between(today, examDate));
        int N = daysUntilExam >= 14 ? 3 : (daysUntilExam >= 5 ? 2 : 0);
        LocalDate revisionStartDate = examDate.minusDays(N);

        // Lấy tất cả bài học
        List<Unit> units = unitRepository.findByCourseIdOrderBySortOrderAsc(courseId);
        Map<LocalDate, List<Lesson>> lessonsByDate = new HashMap<>();

        for (Unit unit : units) {
            List<Section> sections = sectionRepository.findByUnitIdOrderBySortOrderAsc(unit.getId());
            for (Section section : sections) {
                List<Lesson> lessons = lessonRepository.findBySectionIdOrderBySortOrderAsc(section.getId());
                for (Lesson l : lessons) {
                    if (l.getScheduledDate() != null) {
                        lessonsByDate.computeIfAbsent(l.getScheduledDate(), d -> new ArrayList<>()).add(l);
                    }
                }
            }
        }

        // Lấy trạng thái Item để ước lượng số Item ôn trong các ngày tới
        List<ItemState> allStates = itemStateRepository.findAll();
        Map<LocalDate, Integer> reviewsByDate = new HashMap<>();
        for (ItemState state : allStates) {
            if (state.getDueAt() != null) {
                LocalDate dueDate = state.getDueAt().atZoneSameInstant(ZoneId.of("Asia/Ho_Chi_Minh")).toLocalDate();
                reviewsByDate.put(dueDate, reviewsByDate.getOrDefault(dueDate, 0) + 1);
            }
        }

        List<ScheduleResponse.DayScheduleDto> dayDtos = new ArrayList<>();
        boolean hasOverload = false;

        // Dựng lịch từ hôm nay đến ngày thi
        for (int i = 0; i <= daysUntilExam; i++) {
            LocalDate date = today.plusDays(i);
            List<Lesson> dayLessons = lessonsByDate.getOrDefault(date, Collections.emptyList());
            int reviewCount = reviewsByDate.getOrDefault(date, 0);

            boolean isRevisionDay = !date.isBefore(revisionStartDate) && !date.isAfter(examDate);

            // Ước lượng tải: khoảng 3 phút / Lesson mới, 0.3 phút / Item ôn
            double estimatedMinutes = Math.round(((dayLessons.size() * 3.0) + (reviewCount * 0.3)) * 10.0) / 10.0;
            boolean isOverloaded = estimatedMinutes > course.getDailyMinutes();
            if (isOverloaded) hasOverload = true;

            List<ScheduleResponse.LessonSummaryDto> summaries = dayLessons.stream()
                    .map(l -> new ScheduleResponse.LessonSummaryDto(l.getId(), l.getTitle(), l.getStatus()))
                    .collect(Collectors.toList());

            dayDtos.add(new ScheduleResponse.DayScheduleDto(
                    date,
                    dayLessons.size(),
                    reviewCount,
                    estimatedMinutes,
                    isOverloaded,
                    isRevisionDay,
                    summaries
            ));
        }

        String warningMessage = hasOverload
                ? "Lịch học có ngày bị quá tải so với cam kết " + course.getDailyMinutes() + " phút/ngày. Hãy cân nhắc tăng thời gian học hàng ngày hoặc dời ngày thi."
                : null;

        return new ScheduleResponse(course.getDailyMinutes(), hasOverload, warningMessage, dayDtos);
    }

    /**
     * Lấy toàn bộ lộ trình Đường học (Learning Path) hình cây dọc kiểu Duolingo.
     */
    @Transactional(readOnly = true)
    public PathResponse getLearningPath(UUID courseId) {
        Course course = courseRepository.findById(courseId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy khóa học"));

        List<Unit> units = unitRepository.findByCourseIdOrderBySortOrderAsc(courseId);
        List<PathResponse.UnitDto> unitDtos = new ArrayList<>();

        for (Unit unit : units) {
            List<Section> sections = sectionRepository.findByUnitIdOrderBySortOrderAsc(unit.getId());
            List<PathResponse.SectionDto> sectionDtos = new ArrayList<>();

            for (Section section : sections) {
                List<Lesson> lessons = lessonRepository.findBySectionIdOrderBySortOrderAsc(section.getId());
                List<PathResponse.LessonDto> lessonDtos = new ArrayList<>();

                for (Lesson lesson : lessons) {
                    List<Item> items = itemRepository.findByLessonId(lesson.getId());
                    lessonDtos.add(new PathResponse.LessonDto(
                            lesson.getId(),
                            lesson.getSortOrder(),
                            lesson.getTitle(),
                            lesson.getStatus(),
                            lesson.getScheduledDate(),
                            lesson.getBestScore(),
                            items.size()
                    ));
                }
                sectionDtos.add(new PathResponse.SectionDto(section.getId(), section.getSortOrder(), section.getTitle(), lessonDtos));
            }
            unitDtos.add(new PathResponse.UnitDto(unit.getId(), unit.getSortOrder(), unit.getTitle(), sectionDtos));
        }

        return new PathResponse(course.getId(), course.getTitle(), course.getExamDate(), course.getDailyMinutes(), unitDtos);
    }
}
