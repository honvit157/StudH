package com.studyapp.service;

import com.studyapp.model.ItemState;
import com.studyapp.model.ReviewLog;
import com.studyapp.repository.ItemStateRepository;
import com.studyapp.repository.ReviewLogRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.UUID;

@Service
public class SrsService {

    private final ItemStateRepository itemStateRepository;
    private final ReviewLogRepository reviewLogRepository;

    public SrsService(ItemStateRepository itemStateRepository, ReviewLogRepository reviewLogRepository) {
        this.itemStateRepository = itemStateRepository;
        this.reviewLogRepository = reviewLogRepository;
    }

    /**
     * Quy đổi quality:
     * sai = 0;
     * đúng nhưng trả lời quá 15 giây = 3;
     * đúng = 4;
     * đúng và dưới 5 giây = 5.
     */
    public int calculateQuality(boolean correct, long responseMs) {
        if (!correct) {
            return 0;
        }
        if (responseMs < 5000) {
            return 5;
        }
        if (responseMs > 15000) {
            return 3;
        }
        return 4;
    }

    /**
     * Cập nhật trạng thái SRS của Item sau mỗi lượt trả lời.
     *
     * @param itemId ID của Item
     * @param correct Đúng hay sai
     * @param responseMs Thời gian trả lời tính bằng mili-giây
     * @param examDate Ngày thi (nếu có để giới hạn dueAt không vượt quá ngày thi)
     * @return ItemState đã được cập nhật
     */
    @Transactional
    public ItemState processReview(UUID itemId, boolean correct, long responseMs, LocalDate examDate) {
        int quality = calculateQuality(correct, responseMs);

        // Lưu vào ReviewLog
        ReviewLog log = new ReviewLog(itemId, correct, responseMs);
        reviewLogRepository.save(log);

        ItemState state = itemStateRepository.findById(itemId)
                .orElseGet(() -> new ItemState(itemId));

        updateSrsState(state, quality, examDate);
        return itemStateRepository.save(state);
    }

    /**
     * Logic thuần của thuật toán SM-2 rút gọn.
     */
    public void updateSrsState(ItemState state, int quality, LocalDate examDate) {
        OffsetDateTime now = OffsetDateTime.now();
        state.setLastResult(quality >= 3 ? "CORRECT" : "INCORRECT");

        if (quality < 3) {
            state.setRepetitions(0);
            state.setIntervalDays(1);
            // Item gặp lần đầu trong phiên mà sai thì chưa tính là lapse
            if (state.isIntroduced()) {
                state.setLapses(state.getLapses() + 1);
            }
        } else {
            int newRepetitions = state.getRepetitions() + 1;
            state.setRepetitions(newRepetitions);

            if (newRepetitions == 1) {
                state.setIntervalDays(1);
            } else if (newRepetitions == 2) {
                state.setIntervalDays(3);
            } else {
                long nextInterval = Math.round(state.getIntervalDays() * state.getEase());
                state.setIntervalDays((int) Math.max(1, nextInterval));
            }

            // ease = max(1.3, ease + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
            double newEase = state.getEase() + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
            state.setEase(Math.max(1.3, Math.round(newEase * 100.0) / 100.0));
        }

        // Đánh dấu đã được giới thiệu sau lần làm đầu tiên
        state.setIntroduced(true);

        // dueAt = now + intervalDays; nếu vượt ngày thi thì kéo về trước ngày thi
        OffsetDateTime due = now.plusDays(state.getIntervalDays());
        if (examDate != null) {
            OffsetDateTime examDeadline = examDate.atStartOfDay(ZoneId.of("Asia/Ho_Chi_Minh")).toOffsetDateTime();
            if (due.isAfter(examDeadline)) {
                // Kéo về trước ngày thi 1 ngày (hoặc chính ngày thi nếu sát)
                due = examDeadline.minusDays(1);
                if (due.isBefore(now)) {
                    due = now;
                }
            }
        }
        state.setDueAt(due);
    }
}
