package com.studyapp.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.studyapp.dto.AnswerRequest;
import com.studyapp.dto.FinishSessionRequest;
import com.studyapp.model.Course;
import com.studyapp.model.Item;
import com.studyapp.model.Lesson;
import com.studyapp.model.Section;
import com.studyapp.model.Unit;
import com.studyapp.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.util.Collections;
import java.util.List;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public class SessionControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

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

    private Item testItem;

    @BeforeEach
    void setUp() {
        itemRepository.deleteAll();
        lessonRepository.deleteAll();
        sectionRepository.deleteAll();
        unitRepository.deleteAll();
        courseRepository.deleteAll();

        Course course = new Course("Luyện Thi Java Test", LocalDate.now().plusDays(10), 20);
        courseRepository.save(course);

        Unit unit = new Unit(course.getId(), 1, "Unit Test");
        unitRepository.save(unit);

        Section section = new Section(unit.getId(), 1, "Section Test");
        sectionRepository.save(section);

        Lesson lesson = new Lesson(section.getId(), 1, "Lesson Test", "Source text content");
        lesson.setScheduledDate(LocalDate.now());
        lesson.setStatus("ready");
        lessonRepository.save(lesson);

        testItem = new Item(lesson.getId(),
                "Câu hỏi test 1?",
                "Giới thiệu test 1",
                "Đáp án đúng",
                "[\"Sai 1\", \"Sai 2\", \"Sai 3\"]",
                "Giải thích vì sao đúng",
                "Trích dẫn");
        itemRepository.save(testItem);
    }

    @Test
    @WithMockUser(username = "user")
    @DisplayName("GET /api/session/today trả về hàng đợi học tập hôm nay")
    void testGetTodaySession() throws Exception {
        mockMvc.perform(get("/api/session/today"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalItems").value(1))
                .andExpect(jsonPath("$.items[0].prompt").value("Câu hỏi test 1?"))
                .andExpect(jsonPath("$.items[0].options.length()").value(4));
    }

    @Test
    @WithMockUser(username = "user")
    @DisplayName("POST /api/session/answer chấm điểm chính xác và trả về giải thích")
    void testSubmitAnswerCorrect() throws Exception {
        AnswerRequest request = new AnswerRequest(testItem.getId(), "Đáp án đúng", 3000, false);

        mockMvc.perform(post("/api/session/answer")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.correct").value(true))
                .andExpect(jsonPath("$.xpEarned").value(10))
                .andExpect(jsonPath("$.shouldRepeatInSession").value(false));
    }

    @Test
    @WithMockUser(username = "user")
    @DisplayName("POST /api/session/answer khi sai sẽ yêu cầu lặp lại trong phiên")
    void testSubmitAnswerWrong() throws Exception {
        AnswerRequest request = new AnswerRequest(testItem.getId(), "Sai 1", 5000, false);

        mockMvc.perform(post("/api/session/answer")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.correct").value(false))
                .andExpect(jsonPath("$.xpEarned").value(0))
                .andExpect(jsonPath("$.shouldRepeatInSession").value(true));
    }

    @Test
    @WithMockUser(username = "user")
    @DisplayName("POST /api/session/finish tổng kết phiên, cộng thưởng hoàn hảo và cập nhật streak")
    void testFinishSessionPerfect() throws Exception {
        FinishSessionRequest request = new FinishSessionRequest(5, 5, 0, 50, true, Collections.emptyList());

        mockMvc.perform(post("/api/session/finish")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isPerfect").value(true))
                .andExpect(jsonPath("$.bonusXp").value(20))
                .andExpect(jsonPath("$.grandTotalXp").value(70))
                .andExpect(jsonPath("$.currentStreak").value(1));
    }
}
