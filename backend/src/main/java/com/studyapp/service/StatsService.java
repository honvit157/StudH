package com.studyapp.service;

import com.studyapp.dto.StatsResponse;
import com.studyapp.model.Course;
import com.studyapp.model.Item;
import com.studyapp.model.ItemState;
import com.studyapp.model.Profile;
import com.studyapp.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class StatsService {

    private final ProfileRepository profileRepository;
    private final CourseRepository courseRepository;
    private final ItemRepository itemRepository;
    private final ItemStateRepository itemStateRepository;
    private final ReviewLogRepository reviewLogRepository;

    public StatsService(ProfileRepository profileRepository,
                        CourseRepository courseRepository,
                        ItemRepository itemRepository,
                        ItemStateRepository itemStateRepository,
                        ReviewLogRepository reviewLogRepository) {
        this.profileRepository = profileRepository;
        this.courseRepository = courseRepository;
        this.itemRepository = itemRepository;
        this.itemStateRepository = itemStateRepository;
        this.reviewLogRepository = reviewLogRepository;
    }

    @Transactional(readOnly = true)
    public StatsResponse getStats() {
        Profile profile = profileRepository.findById("default")
                .orElseGet(() -> new Profile("default"));

        LocalDate today = LocalDate.now(ZoneId.of(profile.getTimezone()));

        // Reset xpToday nếu sang ngày mới
        int currentXpToday = profile.getXpToday();
        if (profile.getLastActiveDate() != null && !profile.getLastActiveDate().equals(today)) {
            currentXpToday = 0;
        }

        // Thông tin ngày thi
        long daysUntilExam = 0;
        List<Course> courses = courseRepository.findAllByOrderByCreatedAtDesc();
        if (!courses.isEmpty() && courses.get(0).getExamDate() != null) {
            LocalDate examDate = courses.get(0).getExamDate();
            daysUntilExam = Math.max(0, ChronoUnit.DAYS.between(today, examDate));
        }

        long totalItems = itemRepository.count();
        long masteredCount = itemStateRepository.countByIntervalDaysGreaterThanEqual(21);

        // Learning items & new items
        List<ItemState> allStates = itemStateRepository.findAll();
        long learningCount = allStates.stream().filter(s -> s.isIntroduced() && s.getIntervalDays() < 21).count();
        long newCount = allStates.stream().filter(s -> !s.isIntroduced()).count();

        // Top 10 câu hay sai nhất
        List<StatsResponse.FailedItemStatDto> topFailed = new ArrayList<>();
        List<Object[]> failedRows = reviewLogRepository.findTopFailedItems();
        for (Object[] row : failedRows) {
            UUID itemId = (UUID) row[0];
            long count = ((Number) row[1]).longValue();
            itemRepository.findById(itemId).ifPresent(item -> {
                topFailed.add(new StatsResponse.FailedItemStatDto(
                        item.getPrompt(),
                        item.getAnswer(),
                        item.getExplanation(),
                        count
                ));
            });
        }

        return new StatsResponse(
                profile.getXp(),
                profile.getStreak(),
                profile.getBestStreak(),
                profile.getDailyGoalXp(),
                currentXpToday,
                masteredCount,
                learningCount,
                newCount,
                totalItems,
                daysUntilExam,
                topFailed
        );
    }
}
