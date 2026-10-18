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
    private final UnitRepository unitRepository;
    private final SectionRepository sectionRepository;
    private final LessonRepository lessonRepository;
    private final ItemRepository itemRepository;
    private final ItemStateRepository itemStateRepository;
    private final ProfileRepository profileRepository;
    private final SrsService srsService;
    private final CourseCreationPipelineService pipelineService;
    private final AiService aiService;
    private final ObjectMapper objectMapper;

    public SessionService(CourseRepository courseRepository,
                          UnitRepository unitRepository,
                          SectionRepository sectionRepository,
                          LessonRepository lessonRepository,
                          ItemRepository itemRepository,
                          ItemStateRepository itemStateRepository,
                          ProfileRepository profileRepository,
                          SrsService srsService,
                          CourseCreationPipelineService pipelineService,
                          AiService aiService,
                          ObjectMapper objectMapper) {
        this.courseRepository = courseRepository;
        this.unitRepository = unitRepository;
        this.sectionRepository = sectionRepository;
        this.lessonRepository = lessonRepository;
        this.itemRepository = itemRepository;
        this.itemStateRepository = itemStateRepository;
        this.profileRepository = profileRepository;
        this.srsService = srsService;
        this.pipelineService = pipelineService;
        this.aiService = aiService;
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

        List<Item> currentSessionItems = !newItems.isEmpty() ? newItems : dueItems;
        LessonOverviewDto overview = aiService.generateLessonOverview(
                activeCourse.getTitle(),
                activeCourse.getRawText(),
                currentSessionItems
        );

        return new TodaySessionResponse(
                activeCourse.getTitle(),
                sessionQueue.size(),
                reviewCount,
                newCount,
                estimatedMinutes,
                sessionQueue,
                activeCourse.getTitle(),
                overview
        );
    }

    @Transactional
    public AnswerResponse processAnswer(AnswerRequest request) {
        Item item = itemRepository.findById(request.itemId())
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy câu hỏi: " + request.itemId()));

        String cleanDbAnswer = AiService.cleanChoiceText(item.getAnswer());
        String cleanUserAnswer = AiService.cleanChoiceText(request.selectedAnswer());
        boolean isCorrect = cleanDbAnswer.equalsIgnoreCase(cleanUserAnswer);

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
                cleanDbAnswer,
                AiService.cleanChoiceText(item.getExplanation()),
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

        // Cập nhật trạng thái bài học nếu phiên học thuộc về 1 bài học cụ thể
        if (request.lessonId() != null) {
            lessonRepository.findById(request.lessonId()).ifPresent(lesson -> {
                lesson.setStatus("done");
                int score = request.totalQuestions() > 0
                        ? (int) Math.round((double) request.correctCount() / request.totalQuestions() * 100)
                        : 100;
                lesson.setBestScore(Math.max(lesson.getBestScore() != null ? lesson.getBestScore() : 0, score));
                lesson.setCompletedAt(OffsetDateTime.now());
                lessonRepository.save(lesson);

                unlockNextLesson(lesson);
            });
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

    @Transactional
    public TodaySessionResponse getLessonSession(UUID lessonId) {
        Lesson lesson = lessonRepository.findById(lessonId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy bài học: " + lessonId));

        List<Item> items = itemRepository.findByLessonId(lessonId);
        if (items.isEmpty()) {
            try {
                items = pipelineService.generateItemsForLesson(lessonId);
            } catch (Exception e) {
                System.err.println("Lazy item generation failed for lesson " + lessonId + ": " + e.getMessage());
            }
        }

        if (items.isEmpty()) {
            String sourceText = lesson.getSourceText() != null && !lesson.getSourceText().isBlank()
                    ? lesson.getSourceText() : lesson.getTitle();
            List<AiService.GeneratedItem> genItems = aiService.buildFallbackItems(lesson.getTitle(), sourceText);
            for (AiService.GeneratedItem gi : genItems) {
                try {
                    String distJson = objectMapper.writeValueAsString(gi.distractors());
                    Item item = new Item(lessonId, gi.prompt(), gi.intro(), gi.answer(), distJson, gi.explanation(), gi.sourceQuote());
                    itemRepository.save(item);
                    items.add(item);
                } catch (Exception ignored) {}
            }
        }

        List<SessionItemDto> sessionQueue = new ArrayList<>();
        for (Item item : items) {
            ItemState state = itemStateRepository.findById(item.getId()).orElse(null);
            boolean introduced = state != null && state.isIntroduced();
            sessionQueue.add(mapToDto(item, lesson.getTitle(), introduced, false));
        }

        int estimatedMinutes = Math.max(2, (int) Math.ceil(sessionQueue.size() * 0.5));
        LessonOverviewDto overview = aiService.generateLessonOverview(lesson.getTitle(), lesson.getSourceText(), items);
        return new TodaySessionResponse(lesson.getTitle(), sessionQueue.size(), 0, sessionQueue.size(), estimatedMinutes, sessionQueue, lesson.getTitle(), overview);
    }

    private void unlockNextLesson(Lesson currentLesson) {
        try {
            Section currentSection = sectionRepository.findById(currentLesson.getSectionId()).orElse(null);
            if (currentSection == null) return;

            Unit currentUnit = unitRepository.findById(currentSection.getUnitId()).orElse(null);
            if (currentUnit == null) return;

            List<Unit> units = unitRepository.findByCourseIdOrderBySortOrderAsc(currentUnit.getCourseId());
            List<Lesson> allLessons = new ArrayList<>();
            for (Unit u : units) {
                List<Section> sections = sectionRepository.findByUnitIdOrderBySortOrderAsc(u.getId());
                for (Section s : sections) {
                    allLessons.addAll(lessonRepository.findBySectionIdOrderBySortOrderAsc(s.getId()));
                }
            }

            for (int i = 0; i < allLessons.size() - 1; i++) {
                if (allLessons.get(i).getId().equals(currentLesson.getId())) {
                    Lesson next = allLessons.get(i + 1);
                    if ("locked".equalsIgnoreCase(next.getStatus())) {
                        next.setStatus("ready");
                        lessonRepository.save(next);
                        try {
                            pipelineService.generateItemsForLesson(next.getId());
                        } catch (Exception ignored) {}
                    }
                    break;
                }
            }
        } catch (Exception e) {
            System.err.println("Could not unlock next lesson: " + e.getMessage());
        }
    }

    private SessionItemDto mapToDto(Item item, String lessonTitle, boolean introduced, boolean isReview) {
        String cleanAnswer = AiService.cleanChoiceText(item.getAnswer());
        List<String> options = new ArrayList<>();
        options.add(cleanAnswer);

        try {
            List<String> distractors = objectMapper.readValue(item.getDistractors(), new TypeReference<List<String>>() {});
            if (distractors != null) {
                for (String d : distractors) {
                    String cd = AiService.cleanChoiceText(d);
                    if (!cd.equalsIgnoreCase(cleanAnswer) && !options.contains(cd)) {
                        options.add(cd);
                    }
                }
            }
        } catch (Exception e) {
            options.addAll(List.of("Đáp án A", "Đáp án B", "Đáp án C"));
        }

        while (options.size() < 4) {
            String pad = "Phương án " + (char)('A' + options.size());
            if (!options.contains(pad)) options.add(pad);
            else break;
        }

        // Xáo trộn vị trí các đáp án ngẫu nhiên
        Collections.shuffle(options);

        return new SessionItemDto(
                item.getId(),
                item.getLessonId(),
                lessonTitle,
                item.getPrompt(),
                item.getIntro(),
                cleanAnswer,
                options,
                AiService.cleanChoiceText(item.getExplanation()),
                item.getSourceQuote(),
                introduced,
                isReview
        );
    }
}
