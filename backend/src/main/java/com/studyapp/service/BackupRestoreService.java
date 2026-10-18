package com.studyapp.service;

import com.studyapp.dto.DataBackupDto;
import com.studyapp.model.Profile;
import com.studyapp.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;

@Service
public class BackupRestoreService {

    private final CourseRepository courseRepository;
    private final UnitRepository unitRepository;
    private final SectionRepository sectionRepository;
    private final LessonRepository lessonRepository;
    private final ItemRepository itemRepository;
    private final ItemStateRepository itemStateRepository;
    private final ReviewLogRepository reviewLogRepository;
    private final ProfileRepository profileRepository;

    public BackupRestoreService(CourseRepository courseRepository,
                                UnitRepository unitRepository,
                                SectionRepository sectionRepository,
                                LessonRepository lessonRepository,
                                ItemRepository itemRepository,
                                ItemStateRepository itemStateRepository,
                                ReviewLogRepository reviewLogRepository,
                                ProfileRepository profileRepository) {
        this.courseRepository = courseRepository;
        this.unitRepository = unitRepository;
        this.sectionRepository = sectionRepository;
        this.lessonRepository = lessonRepository;
        this.itemRepository = itemRepository;
        this.itemStateRepository = itemStateRepository;
        this.reviewLogRepository = reviewLogRepository;
        this.profileRepository = profileRepository;
    }

    public DataBackupDto exportData() {
        DataBackupDto backup = new DataBackupDto();
        backup.setVersion("1.0");
        backup.setExportedAt(OffsetDateTime.now());
        backup.setProfile(profileRepository.findById("default").orElse(null));
        backup.setCourses(courseRepository.findAll());
        backup.setUnits(unitRepository.findAll());
        backup.setSections(sectionRepository.findAll());
        backup.setLessons(lessonRepository.findAll());
        backup.setItems(itemRepository.findAll());
        backup.setItemStates(itemStateRepository.findAll());
        backup.setReviewLogs(reviewLogRepository.findAll());
        return backup;
    }

    @Transactional
    public void restoreData(DataBackupDto backup) {
        if (backup == null) {
            throw new IllegalArgumentException("Dữ liệu sao lưu không hợp lệ");
        }

        // Xóa sạch dữ liệu cũ theo đúng thứ tự ràng buộc khóa ngoại
        reviewLogRepository.deleteAllInBatch();
        itemStateRepository.deleteAllInBatch();
        itemRepository.deleteAllInBatch();
        lessonRepository.deleteAllInBatch();
        sectionRepository.deleteAllInBatch();
        unitRepository.deleteAllInBatch();
        courseRepository.deleteAllInBatch();

        // Nạp dữ liệu mới theo thứ tự cha -> con
        if (backup.getProfile() != null) {
            profileRepository.save(backup.getProfile());
        }
        if (backup.getCourses() != null && !backup.getCourses().isEmpty()) {
            courseRepository.saveAll(backup.getCourses());
        }
        if (backup.getUnits() != null && !backup.getUnits().isEmpty()) {
            unitRepository.saveAll(backup.getUnits());
        }
        if (backup.getSections() != null && !backup.getSections().isEmpty()) {
            sectionRepository.saveAll(backup.getSections());
        }
        if (backup.getLessons() != null && !backup.getLessons().isEmpty()) {
            lessonRepository.saveAll(backup.getLessons());
        }
        if (backup.getItems() != null && !backup.getItems().isEmpty()) {
            itemRepository.saveAll(backup.getItems());
        }
        if (backup.getItemStates() != null && !backup.getItemStates().isEmpty()) {
            itemStateRepository.saveAll(backup.getItemStates());
        }
        if (backup.getReviewLogs() != null && !backup.getReviewLogs().isEmpty()) {
            reviewLogRepository.saveAll(backup.getReviewLogs());
        }
    }

    @Transactional
    public void resetAllData() {
        reviewLogRepository.deleteAllInBatch();
        itemStateRepository.deleteAllInBatch();
        itemRepository.deleteAllInBatch();
        lessonRepository.deleteAllInBatch();
        sectionRepository.deleteAllInBatch();
        unitRepository.deleteAllInBatch();
        courseRepository.deleteAllInBatch();

        Profile profile = profileRepository.findById("default").orElseGet(() -> new Profile("default"));
        profile.setXp(0);
        profile.setStreak(0);
        profile.setBestStreak(0);
        profile.setXpToday(0);
        profile.setLastActiveDate(null);
        profileRepository.save(profile);
    }
}
