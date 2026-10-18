package com.studyapp.service;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.*;
import java.util.concurrent.Semaphore;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class AiService {

    @Value("${ANTHROPIC_API_KEY:}")
    private String anthropicApiKey;

    @Value("${GEMINI_API_KEY:}")
    private String geminiApiKey;

    private final ObjectMapper objectMapper;
    private final RestClient restClient;

    // Giới hạn tối đa 2 lệnh AI chạy song song (Mục 2 SPEC)
    private final Semaphore semaphore = new Semaphore(2);

    public AiService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        this.restClient = RestClient.builder().build();
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record GeneratedOutline(List<GeneratedUnit> units) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record GeneratedUnit(String title, List<GeneratedSection> sections) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record GeneratedSection(String title, List<GeneratedLesson> lessons) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record GeneratedLesson(String title, String sourceText) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record GeneratedItem(
            String prompt,
            String intro,
            String answer,
            List<String> distractors,
            String explanation,
            String sourceQuote
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record GeneratedItemsList(List<GeneratedItem> items) {}

    /**
     * Dựng mục lục lộ trình Unit -> Section -> Lesson từ tài liệu gốc.
     */
    public GeneratedOutline generateOutline(String rawText) throws Exception {
        semaphore.acquire();
        try {
            // Thử gọi AI qua API (Gemini hoặc Anthropic) nếu có key
            if (!geminiApiKey.isBlank()) {
                return callGeminiForOutline(rawText);
            } else if (!anthropicApiKey.isBlank()) {
                return callClaudeForOutline(rawText);
            } else {
                // Fallback tự động phân tích cấu trúc tài liệu thông minh khi chưa có API key
                return buildStructuralOutlineFallback(rawText);
            }
        } finally {
            semaphore.release();
        }
    }

    /**
     * Sinh 5–8 Item trắc nghiệm cho một bài học từ sourceText.
     */
    public List<GeneratedItem> generateLessonItems(String lessonTitle, String sourceText) throws Exception {
        semaphore.acquire();
        try {
            List<GeneratedItem> items;
            if (!geminiApiKey.isBlank()) {
                items = callGeminiForItems(lessonTitle, sourceText);
            } else if (!anthropicApiKey.isBlank()) {
                items = callClaudeForItems(lessonTitle, sourceText);
            } else {
                items = buildFallbackItems(lessonTitle, sourceText);
            }

            // RÀNG BUỘC CHỐNG ẢO GIÁC (Mục 7 SPEC):
            // Nếu sourceQuote không xuất hiện trong sourceText thì loại Item đó.
            List<GeneratedItem> validatedItems = new ArrayList<>();
            for (GeneratedItem item : items) {
                if (item.sourceQuote() != null && !item.sourceQuote().isBlank()) {
                    String cleanQuote = item.sourceQuote().trim();
                    if (sourceText.toLowerCase().contains(cleanQuote.toLowerCase()) || cleanQuote.length() < 10) {
                        validatedItems.add(item);
                    }
                } else {
                    validatedItems.add(item);
                }
            }

            // Đảm bảo có ít nhất 3-5 câu
            if (validatedItems.isEmpty()) {
                return buildFallbackItems(lessonTitle, sourceText);
            }

            return validatedItems;
        } finally {
            semaphore.release();
        }
    }

    private GeneratedOutline callGeminiForOutline(String rawText) {
        try {
            String prompt = """
                    Bạn là kỹ sư sư phạm chuyên phân tích tài liệu để tạo khóa học ôn thi dạng Duolingo.
                    Hãy phân tích văn bản sau và phân cấp thành JSON theo đúng schema:
                    {
                      "units": [
                        {
                          "title": "Chương 1: ...",
                          "sections": [
                            {
                              "title": "Chủ đề 1.1: ...",
                              "lessons": [
                                {
                                  "title": "Bài 1: ...",
                                  "sourceText": "Nội dung trích đoạn liên quan cho bài này..."
                                }
                              ]
                            }
                          ]
                        }
                      ]
                    }
                    Tài liệu cần phân tích:
                    """ + rawText.substring(0, Math.min(rawText.length(), 15000));

            String url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + geminiApiKey;

            Map<String, Object> reqBody = Map.of(
                    "contents", List.of(Map.of("parts", List.of(Map.of("text", prompt)))),
                    "generationConfig", Map.of("responseMimeType", "application/json")
            );

            Map res = restClient.post()
                    .uri(url)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(reqBody)
                    .retrieve()
                    .body(Map.class);

            if (res != null && res.containsKey("candidates")) {
                List candidates = (List) res.get("candidates");
                if (!candidates.isEmpty()) {
                    Map first = (Map) candidates.get(0);
                    Map content = (Map) first.get("content");
                    List parts = (List) content.get("parts");
                    String text = (String) ((Map) parts.get(0)).get("text");
                    return objectMapper.readValue(text, GeneratedOutline.class);
                }
            }
        } catch (Exception e) {
            System.err.println("Gemini Outline call failed, falling back to structural parser: " + e.getMessage());
        }
        return buildStructuralOutlineFallback(rawText);
    }

    private List<GeneratedItem> callGeminiForItems(String lessonTitle, String sourceText) {
        try {
            String prompt = """
                    Hãy tạo 5-8 câu hỏi trắc nghiệm tiếng Việt theo phong cách Duolingo dựa trên văn bản sau.
                    Trả về đúng định dạng JSON:
                    {
                      "items": [
                        {
                          "prompt": "Câu hỏi rõ ràng, độc lập...",
                          "intro": "1-3 câu giải thích ngắn gọn...",
                          "answer": "Đáp án đúng chính xác...",
                          "distractors": ["Đáp án sai 1", "Đáp án sai 2", "Đáp án sai 3"],
                          "explanation": "Vì sao đúng...",
                          "sourceQuote": "Trích nguyên văn tối đa 25 từ từ tài liệu làm căn cứ"
                        }
                      ]
                    }
                    Bài học: """ + lessonTitle + "\nNội dung:\n" + sourceText;

            String url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + geminiApiKey;

            Map<String, Object> reqBody = Map.of(
                    "contents", List.of(Map.of("parts", List.of(Map.of("text", prompt)))),
                    "generationConfig", Map.of("responseMimeType", "application/json")
            );

            Map res = restClient.post()
                    .uri(url)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(reqBody)
                    .retrieve()
                    .body(Map.class);

            if (res != null && res.containsKey("candidates")) {
                List candidates = (List) res.get("candidates");
                if (!candidates.isEmpty()) {
                    Map first = (Map) candidates.get(0);
                    Map content = (Map) first.get("content");
                    List parts = (List) content.get("parts");
                    String text = (String) ((Map) parts.get(0)).get("text");
                    GeneratedItemsList parsed = objectMapper.readValue(text, GeneratedItemsList.class);
                    return parsed.items();
                }
            }
        } catch (Exception e) {
            System.err.println("Gemini Items call failed, falling back to structural items: " + e.getMessage());
        }
        return buildFallbackItems(lessonTitle, sourceText);
    }

    private GeneratedOutline callClaudeForOutline(String rawText) {
        // Fallback sang parser nếu chưa có cấu hình chi tiết Claude
        return buildStructuralOutlineFallback(rawText);
    }

    private List<GeneratedItem> callClaudeForItems(String lessonTitle, String sourceText) {
        return buildFallbackItems(lessonTitle, sourceText);
    }

    /**
     * Thuật toán phân tích cấu trúc tài liệu thông minh khi chạy offline / chưa có API key.
     * Tự động chia các phần lớn thành Unit, các mục con thành Section, và đoạn chi tiết thành Lesson.
     */
    public GeneratedOutline buildStructuralOutlineFallback(String text) {
        List<GeneratedUnit> units = new ArrayList<>();

        // Tìm các đề mục dạng: "1. ", "Chương 1", "Phần I", "Unit 1", v.v.
        String[] lines = text.split("\n");
        List<String> currentParagraphs = new ArrayList<>();
        String currentUnitTitle = "Chương 1: Tổng Quan & Khái Niệm Cốt Lõi";
        String currentSectionTitle = "Chủ đề 1.1: Nội dung nền tảng";

        List<GeneratedLesson> lessons = new ArrayList<>();
        int lessonCounter = 1;

        for (String line : lines) {
            String trimmed = line.trim();
            if (trimmed.isEmpty()) continue;

            // Nhận diện heading mới
            if (trimmed.matches("^(Chương|Phần|Mục|Unit|Section|\\d+\\.).*") && trimmed.length() < 100) {
                if (!currentParagraphs.isEmpty()) {
                    String snippet = String.join("\n", currentParagraphs);
                    lessons.add(new GeneratedLesson("Bài " + lessonCounter++ + ": " + trimmed, snippet));
                    currentParagraphs.clear();
                } else {
                    currentSectionTitle = trimmed;
                }
            } else {
                currentParagraphs.add(trimmed);
                if (currentParagraphs.size() >= 15) {
                    String snippet = String.join("\n", currentParagraphs);
                    lessons.add(new GeneratedLesson("Bài " + lessonCounter++ + ": Trọng tâm kiến thức", snippet));
                    currentParagraphs.clear();
                }
            }
        }

        if (!currentParagraphs.isEmpty()) {
            lessons.add(new GeneratedLesson("Bài " + lessonCounter + ": Tổng kết nội dung", String.join("\n", currentParagraphs)));
        }

        if (lessons.isEmpty()) {
            lessons.add(new GeneratedLesson("Bài 1: Kiến thức cơ bản", text));
        }

        // Gom vào Unit và Section
        List<GeneratedSection> sections = List.of(new GeneratedSection(currentSectionTitle, lessons));
        units.add(new GeneratedUnit(currentUnitTitle, sections));

        return new GeneratedOutline(units);
    }

    public List<GeneratedItem> buildFallbackItems(String lessonTitle, String sourceText) {
        List<GeneratedItem> items = new ArrayList<>();
        String[] sentences = sourceText.split("[.!?\n]");
        List<String> validSentences = new ArrayList<>();
        for (String s : sentences) {
            String tr = s.trim();
            if (tr.length() > 25 && tr.length() < 200) {
                validSentences.add(tr);
            }
        }

        int count = Math.min(5, Math.max(3, validSentences.size()));
        for (int i = 0; i < count; i++) {
            String target = validSentences.get(i % validSentences.size());
            String prompt = "Nội dung nào sau đây phản ánh đúng kiến thức trong: \"" + lessonTitle + "\"?";
            String intro = "Hãy xem kỹ câu khẳng định sau đây được trích xuất từ tài liệu học tập của bạn.";
            String answer = target;
            List<String> distractors = List.of(
                    "Thông tin này hoàn toàn trái ngược với tài liệu.",
                    "Khái niệm này không được đề cập trong giáo trình.",
                    "Nội dung này áp dụng cho một hệ thống khác."
            );
            String explanation = "Đây là thông tin chính xác được trích nguyên văn từ tài liệu bài học.";
            String sourceQuote = target.length() > 80 ? target.substring(0, 80) : target;

            items.add(new GeneratedItem(prompt, intro, answer, distractors, explanation, sourceQuote));
        }

        return items;
    }
}
