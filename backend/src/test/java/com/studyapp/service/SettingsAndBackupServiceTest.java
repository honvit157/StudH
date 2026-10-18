package com.studyapp.service;

import com.studyapp.dto.DataBackupDto;
import com.studyapp.dto.SettingsDto;
import com.studyapp.dto.UpdateSettingsRequest;
import com.studyapp.model.Course;
import com.studyapp.model.Profile;
import com.studyapp.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class SettingsAndBackupServiceTest {

    private ProfileRepository profileRepository;
    private CourseRepository courseRepository;
    private UnitRepository unitRepository;
    private SectionRepository sectionRepository;
    private LessonRepository lessonRepository;
    private ItemRepository itemRepository;
    private ItemStateRepository itemStateRepository;
    private ReviewLogRepository reviewLogRepository;

    private SettingsService settingsService;
    private BackupRestoreService backupRestoreService;

    @BeforeEach
    void setUp() {
        profileRepository = mock(ProfileRepository.class);
        courseRepository = mock(CourseRepository.class);
        unitRepository = mock(UnitRepository.class);
        sectionRepository = mock(SectionRepository.class);
        lessonRepository = mock(LessonRepository.class);
        itemRepository = mock(ItemRepository.class);
        itemStateRepository = mock(ItemStateRepository.class);
        reviewLogRepository = mock(ReviewLogRepository.class);

        settingsService = new SettingsService(profileRepository, courseRepository);
        backupRestoreService = new BackupRestoreService(
                courseRepository, unitRepository, sectionRepository,
                lessonRepository, itemRepository, itemStateRepository,
                reviewLogRepository, profileRepository
        );
    }

    @Test
    @DisplayName("Lấy cấu hình cài đặt thành công")
    void testGetSettings() {
        Profile profile = new Profile("default");
        profile.setDailyGoalXp(30);
        profile.setTimezone("Asia/Ho_Chi_Minh");
        profile.setSoundEnabled(true);
        profile.setTheme("dark");

        Course course = new Course("Web Dev Course", LocalDate.now().plusDays(20), 25);
        course.setStatus("ACTIVE");

        when(profileRepository.findById("default")).thenReturn(Optional.of(profile));
        when(courseRepository.findAll()).thenReturn(List.of(course));

        SettingsDto settings = settingsService.getSettings();

        assertNotNull(settings);
        assertEquals(30, settings.getDailyGoalXp());
        assertEquals("dark", settings.getTheme());
        assertTrue(settings.isSoundEnabled());
        assertEquals(25, settings.getDailyMinutes());
        assertEquals("Web Dev Course", settings.getActiveCourseTitle());
    }

    @Test
    @DisplayName("Cập nhật cấu hình thành công")
    void testUpdateSettings() {
        Profile profile = new Profile("default");
        Course course = new Course("Web Dev Course", LocalDate.now().plusDays(20), 20);
        course.setStatus("ACTIVE");

        when(profileRepository.findById("default")).thenReturn(Optional.of(profile));
        when(courseRepository.findAll()).thenReturn(List.of(course));

        UpdateSettingsRequest req = new UpdateSettingsRequest();
        req.setDailyGoalXp(50);
        req.setTheme("light");
        req.setSoundEnabled(false);
        req.setDailyMinutes(45);
        LocalDate newExamDate = LocalDate.now().plusDays(40);
        req.setExamDate(newExamDate);

        SettingsDto result = settingsService.updateSettings(req);

        assertEquals(50, profile.getDailyGoalXp());
        assertEquals("light", profile.getTheme());
        assertFalse(profile.isSoundEnabled());
        assertEquals(45, course.getDailyMinutes());
        assertEquals(newExamDate, course.getExamDate());
        verify(profileRepository).save(profile);
        verify(courseRepository).save(course);
    }

    @Test
    @DisplayName("Xuất dữ liệu dự phòng JSON thành công")
    void testExportData() {
        Profile profile = new Profile("default");
        Course course = new Course("Test Course", LocalDate.now().plusDays(15), 15);

        when(profileRepository.findById("default")).thenReturn(Optional.of(profile));
        when(courseRepository.findAll()).thenReturn(List.of(course));
        when(unitRepository.findAll()).thenReturn(List.of());
        when(sectionRepository.findAll()).thenReturn(List.of());
        when(lessonRepository.findAll()).thenReturn(List.of());
        when(itemRepository.findAll()).thenReturn(List.of());
        when(itemStateRepository.findAll()).thenReturn(List.of());
        when(reviewLogRepository.findAll()).thenReturn(List.of());

        DataBackupDto backup = backupRestoreService.exportData();

        assertNotNull(backup);
        assertEquals("1.0", backup.getVersion());
        assertEquals(1, backup.getCourses().size());
        assertEquals("Test Course", backup.getCourses().get(0).getTitle());
    }

    @Test
    @DisplayName("Khôi phục dữ liệu từ bản sao lưu thành công")
    void testRestoreData() {
        DataBackupDto backup = new DataBackupDto();
        Profile profile = new Profile("default");
        profile.setXp(120);
        backup.setProfile(profile);

        Course course = new Course("Restored Course", LocalDate.now().plusDays(10), 30);
        backup.setCourses(List.of(course));

        backupRestoreService.restoreData(backup);

        // Verify clean deletion order
        verify(reviewLogRepository).deleteAllInBatch();
        verify(itemStateRepository).deleteAllInBatch();
        verify(itemRepository).deleteAllInBatch();
        verify(lessonRepository).deleteAllInBatch();
        verify(sectionRepository).deleteAllInBatch();
        verify(unitRepository).deleteAllInBatch();
        verify(courseRepository).deleteAllInBatch();

        // Verify restoration order
        verify(profileRepository).save(profile);
        verify(courseRepository).saveAll(backup.getCourses());
    }

    @Test
    @DisplayName("Xóa sạch toàn bộ dữ liệu học tập thành công")
    void testResetAllData() {
        Profile profile = new Profile("default");
        profile.setXp(500);
        profile.setStreak(10);
        when(profileRepository.findById("default")).thenReturn(Optional.of(profile));

        backupRestoreService.resetAllData();

        verify(courseRepository).deleteAllInBatch();
        verify(lessonRepository).deleteAllInBatch();
        assertEquals(0, profile.getXp());
        assertEquals(0, profile.getStreak());
        verify(profileRepository).save(profile);
    }
}
