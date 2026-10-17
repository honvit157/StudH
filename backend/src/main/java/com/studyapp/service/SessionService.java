package com.studyapp.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.studyapp.dto.*;
import com.studyapp.model.*;
import com.studyapp.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class SessionService {

    private final CourseRepository courseRepository;
    private final LessonRepository lessonRepository;
    private final ItemRepository itemRepository;
    private final ItemStateRepository itemStateRepository;
    private final ProfileRepository profileRepository;
    private final SrsService srsService;
    private final ObjectMapper objectMapper;

    public SessionService(CourseRepository courseRepository,
                          LessonRepository lessonRepository,
                          ItemRepository itemRepository,
                          ItemStateRepository itemStateRepository,
                          ProfileRepository profileRepository,
                          SrsService srsService,
                          ObjectMapper objectMapper) {
        this.courseRepository = courseRepository;
        this.lessonRepository = lessonRepository;
        this.itemRepository = itemRepository;
        this.itemStateRepository = itemStateRepository;
        this.profileRepository = profileRepository;
        this.srsService = srsService;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public TodaySessionResponse getTodaySession() {
        List<Course> courses = courseRepository.findAllByOrderByCreatedAtDesc();
        if (courses.isEmpty()) {
            return new TodaySessionResponse("Chưa có khóa học", 0, 0, 0, 0, Collections.emptyList());
        }

        Course activeCourse = courses.get(0);
        int dailyMinutes = activeCourse.getDailyMinutes();
        OffsetDateTime now = OffsetDateTime.now();
        LocalDate today = LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh"));

        // 1. Tìm các Item đến hạn ôn tập (dueAt <= now)
        List<ItemState> dueStates = itemStateRepository.findByDueAtLessThanEqualOrderByDueAtAsc(now);
        List<UUID> dueItemIds = dueStates.stream().map(ItemState::getItemId).collect(Collectors.toList());

        List<Item> dueItems = dueItemIds.isEmpty() ? Collections.emptyList() : itemRepository.findAllById(dueItemIds);
        Map<UUID, Item> dueItemMap = dueItems.stream().collect(Collectors.toMap(Item::getId, i -> i));

        // 2. Tìm các Lesson mới có scheduledDate <= hôm nay
        List<Lesson> scheduledLessons = lessonRepository.findByScheduledDateLessThanEqualAndStatusNotOrderByScheduledDateAscSortOrderAsc(today, "done");

        List<Item> newItems = new ArrayList<>();
        Map<UUID, String> lessonTitleMap = new HashMap<>();

        for (Lesson lesson : scheduledLessons) {
            lessonTitleMap.put(lesson.getId(), lesson.getTitle());
            List<Item> items = itemRepository.findByLessonId(lesson.getId());
            for (Item item : items) {
                if (!dueItemMap.containsKey(item.getId())) {
                    newItems.add(item);
                }
            }
        }

        // Cân bằng thời lượng theo dailyMinutes:
        // Ước lượng: 3 phút / Lesson mới, 0.3 phút / Item ôn
        List<SessionItemDto> sessionQueue = new ArrayList<>();
        int reviewCount = 0;
        int newCount = 0;

        // Ưu tiên 1: Đưa các Item ôn tập vào trước
        for (ItemState state : dueStates) {
            Item item = dueItemMap.get(state.getItemId());
            if (item != null) {
                String lessonTitle = lessonTitleMap.computeIfAbsent(item.getLessonId(), id ->
                        lessonRepository.findById(id).map(Lesson::getTitle).orElse("Ôn tập kiến thức"));
                sessionQueue.add(mapToDto(item, lessonTitle, state.isIntroduced(), true));
                reviewCount++;
                if (sessionQueue.size() >= 25) break; // Giới hạn tối đa một phiên
            }
        }

        // Ưu tiên 2: Thêm các Item bài mới nếu còn thời gian
        for (Item item : newItems) {
            if (sessionQueue.size() >= 20) break;
            ItemState state = itemStateRepository.findById(item.getId()).orElse(null);
            boolean introduced = state != null && state.isIntroduced();
            String lessonTitle = lessonTitleMap.computeIfAbsent(item.getLessonId(), id ->
                    lessonRepository.findById(id).map(Lesson::getTitle).orElse("Bài học mới"));
            sessionQueue.add(mapToDto(item, lessonTitle, introduced, false));
            newCount++;
        }

        // Nếu cả 2 đều trống (đã hoàn thành hết), lấy các câu hỏi mẫu để người dùng có thể ôn tập tự do
        if (sessionQueue.isEmpty()) {
            List<Item> fallbackItems = itemRepository.findAll();
            for (int i = 0; i < Math.min(10, fallbackItems.size()); i++) {
                Item item = fallbackItems.get(i);
                ItemState state = itemStateRepository.findById(item.getId()).orElse(null);
                boolean introduced = state != null && state.isIntroduced();
                String title = lessonRepository.findById(item.getLessonId()).map(Lesson::getTitle).orElse("Ôn tập kiến thức");
                sessionQueue.add(mapToDto(item, title, introduced, true));
                reviewCount++;
            }
        }

        int estimatedMinutes = (int) Math.ceil((reviewCount * 0.3) + (newCount * 0.5));
        if (estimatedMinutes == 0 && !sessionQueue.isEmpty()) estimatedMinutes = 3;

        return new TodaySessionResponse(activeCourse.getTitle(), sessionQueue.size(), reviewCount, newCount, estimatedMinutes, sessionQueue);
    }

    @Transactional
    public AnswerResponse processAnswer(AnswerRequest request) {
        Item item = itemRepository.findById(request.itemId())
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy câu hỏi: " + request.itemId()));

        boolean isCorrect = item.getAnswer().trim().equalsIgnoreCase(request.selectedAnswer().trim());

        // Tìm khóa học để lấy ngày thi
        LocalDate examDate = null;
        Lesson lesson = lessonRepository.findById(item.getLessonId()).orElse(null);
        if (lesson != null) {
            examDate = courseRepository.findAll().stream().findFirst().map(Course::getExamDate).orElse(null);
        }

        ItemState updatedState = srsService.processReview(item.getId(), isCorrect, request.responseMs(), examDate);
        int quality = srsService.calculateQuality(isCorrect, request.responseMs());

        // Tính XP
        int xpEarned = 0;
        if (isCorrect) {
            xpEarned = request.isRetry() ? 5 : 10;
        }

        boolean shouldRepeat = !isCorrect;

        return new AnswerResponse(
                isCorrect,
                item.getAnswer(),
                item.getExplanation(),
                item.getSourceQuote(),
                xpEarned,
                quality,
                shouldRepeat
        );
    }

    @Transactional
    public FinishSessionResponse finishSession(FinishSessionRequest request) {
        Profile profile = profileRepository.findById("default")
                .orElseGet(() -> new Profile("default"));

        LocalDate today = LocalDate.now(ZoneId.of(profile.getTimezone()));
        LocalDate lastActive = profile.getLastActiveDate();

        // Cập nhật streak
        if (lastActive == null) {
            profile.setStreak(1);
        } else if (!lastActive.equals(today)) {
            if (lastActive.equals(today.minusDays(1))) {
                profile.setStreak(profile.getStreak() + 1);
            } else {
                profile.setStreak(1);
            }
        }
        profile.setBestStreak(Math.max(profile.getBestStreak(), profile.getStreak()));
        profile.setLastActiveDate(today);

        // Tính điểm XP
        int bonusXp = request.isPerfect() ? 20 : 0;
        int grandTotalXp = request.totalXpEarned() + bonusXp;

        profile.setXp(profile.getXp() + grandTotalXp);
        profile.setXpToday(profile.getXpToday() + grandTotalXp);
        profileRepository.save(profile);

        // Lấy danh sách failedItems nếu có
        List<SessionItemDto> failedItems = Collections.emptyList();
        if (request.failedItemIds() != null && !request.failedItemIds().isEmpty()) {
            failedItems = itemRepository.findAllById(request.failedItemIds()).stream()
                    .map(i -> mapToDto(i, "Đã sai trong phiên", true, true))
                    .collect(Collectors.toList());
        }

        return new FinishSessionResponse(
                request.totalQuestions(),
                request.correctCount(),
                request.incorrectCount(),
                request.totalXpEarned(),
                bonusXp,
                grandTotalXp,
                profile.getStreak(),
                request.isPerfect(),
                failedItems
        );
    }

    private SessionItemDto mapToDto(Item item, String lessonTitle, boolean introduced, boolean isReview) {
        List<String> options = new ArrayList<>();
        options.add(item.getAnswer());

        try {
            List<String> distractors = objectMapper.readValue(item.getDistractors(), new TypeReference<List<String>>() {});
            if (distractors != null) {
                options.addAll(distractors);
            }
        } catch (Exception e) {
            // Fallback nếu parse lỗi
            options.addAll(List.of("Đáp án A", "Đáp án B", "Đáp án C"));
        }

        // Xáo trộn vị trí các đáp án ngẫu nhiên
        Collections.shuffle(options);

        return new SessionItemDto(
                item.getId(),
                item.getLessonId(),
                lessonTitle,
                item.getPrompt(),
                item.getIntro(),
                item.getAnswer(),
                options,
                item.getExplanation(),
                item.getSourceQuote(),
                introduced,
                isReview
        );
    }
}
