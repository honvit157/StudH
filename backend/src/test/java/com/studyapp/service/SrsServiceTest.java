package com.studyapp.service;

import com.studyapp.model.ItemState;
import com.studyapp.repository.ItemStateRepository;
import com.studyapp.repository.ReviewLogRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class SrsServiceTest {

    @Mock
    private ItemStateRepository itemStateRepository;

    @Mock
    private ReviewLogRepository reviewLogRepository;

    private SrsService srsService;

    @BeforeEach
    void setUp() {
        srsService = new SrsService(itemStateRepository, reviewLogRepository);
    }

    @Test
    @DisplayName("Quy đổi điểm chất lượng Quality chính xác theo thời gian trả lời")
    void testCalculateQuality() {
        // Sai luôn là 0
        assertEquals(0, srsService.calculateQuality(false, 2000));
        assertEquals(0, srsService.calculateQuality(false, 20000));

        // Đúng dưới 5s -> 5
        assertEquals(5, srsService.calculateQuality(true, 4999));
        assertEquals(5, srsService.calculateQuality(true, 1000));

        // Đúng từ 5s đến 15s -> 4
        assertEquals(4, srsService.calculateQuality(true, 5000));
        assertEquals(4, srsService.calculateQuality(true, 15000));

        // Đúng trên 15s -> 3
        assertEquals(3, srsService.calculateQuality(true, 15001));
        assertEquals(3, srsService.calculateQuality(true, 30000));
    }

    @Test
    @DisplayName("Lần đầu gặp trong phiên mà trả lời sai thì chưa tính là lapse")
    void testFirstTimeWrongNotLapse() {
        ItemState state = new ItemState(UUID.randomUUID());
        assertFalse(state.isIntroduced());
        assertEquals(0, state.getLapses());

        // Trả lời sai (quality = 0)
        srsService.updateSrsState(state, 0, null);

        assertTrue(state.isIntroduced());
        assertEquals(0, state.getLapses(), "Lần đầu gặp sai chưa được tính là lapse");
        assertEquals(0, state.getRepetitions());
        assertEquals(1, state.getIntervalDays());
    }

    @Test
    @DisplayName("Đã học rồi (introduced=true) mà trả lời sai thì tính lapse và reset repetitions")
    void testSecondTimeWrongIncrementsLapse() {
        ItemState state = new ItemState(UUID.randomUUID());
        state.setIntroduced(true);
        state.setRepetitions(2);
        state.setIntervalDays(3);
        state.setLapses(0);

        // Trả lời sai (quality = 0)
        srsService.updateSrsState(state, 0, null);

        assertEquals(1, state.getLapses());
        assertEquals(0, state.getRepetitions());
        assertEquals(1, state.getIntervalDays());
    }

    @Test
    @DisplayName("Chu kỳ tăng dần khi trả lời đúng: Lần 1 = 1 ngày, Lần 2 = 3 ngày, Lần 3 = round(interval * ease)")
    void testSpacedRepetitionIntervalProgression() {
        ItemState state = new ItemState(UUID.randomUUID());

        // Lần 1 đúng (< 5s, q=5)
        srsService.updateSrsState(state, 5, null);
        assertEquals(1, state.getRepetitions());
        assertEquals(1, state.getIntervalDays());
        assertEquals(2.6, state.getEase(), 0.01);

        // Lần 2 đúng (q=4)
        srsService.updateSrsState(state, 4, null);
        assertEquals(2, state.getRepetitions());
        assertEquals(3, state.getIntervalDays());

        // Lần 3 đúng (q=4) -> interval = round(3 * ease)
        double currentEase = state.getEase();
        srsService.updateSrsState(state, 4, null);
        assertEquals(3, state.getRepetitions());
        assertEquals(Math.round(3 * currentEase), state.getIntervalDays());
    }

    @Test
    @DisplayName("Hệ số Ease không bao giờ tụt xuống dưới mức sàn 1.3")
    void testEaseFloorAt1Point3() {
        ItemState state = new ItemState(UUID.randomUUID());
        state.setEase(1.35);

        // Giả sử đúng chật vật với q = 3 liên tiếp
        srsService.updateSrsState(state, 3, null);
        srsService.updateSrsState(state, 3, null);

        assertTrue(state.getEase() >= 1.3, "Ease phải >= 1.3");
    }

    @Test
    @DisplayName("Nếu dueAt vượt quá ngày thi, hệ thống tự động kéo về trước ngày thi")
    void testDueAtClampedBeforeExamDate() {
        ItemState state = new ItemState(UUID.randomUUID());
        state.setRepetitions(3);
        state.setIntervalDays(30); // 30 ngày nữa mới ôn
        state.setEase(2.5);

        LocalDate examDate = LocalDate.now().plusDays(5); // Nhưng 5 ngày nữa đã thi!

        srsService.updateSrsState(state, 5, examDate);

        assertNotNull(state.getDueAt());
        assertTrue(state.getDueAt().isBefore(examDate.plusDays(1).atStartOfDay().atOffset(OffsetDateTime.now().getOffset())),
                "DueAt phải được kéo về trước ngày thi");
    }
}
