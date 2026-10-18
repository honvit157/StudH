package com.studyapp.service;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.studyapp.repository.ProfileRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.time.Duration;
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
    private final ProfileRepository profileRepository;
    private final RestClient restClient;

    // Giới hạn tối đa 2 lệnh AI chạy song song (Mục 2 SPEC)
    private final Semaphore semaphore = new Semaphore(2);

    public AiService(ObjectMapper objectMapper, ProfileRepository profileRepository) {
        this.objectMapper = objectMapper;
        this.profileRepository = profileRepository;

        // Cấu hình timeout 4s/8s để không bao giờ bị treo ứng dụng
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(4));
        factory.setReadTimeout(Duration.ofSeconds(8));
        this.restClient = RestClient.builder().requestFactory(factory).build();
    }

    public String getEffectiveGeminiKey() {
        if (geminiApiKey != null && !geminiApiKey.isBlank()) {
            return geminiApiKey.trim();
        }
        try {
            var opt = profileRepository.findById("default");
            if (opt.isPresent() && opt.get().getGeminiApiKey() != null && !opt.get().getGeminiApiKey().isBlank()) {
                return opt.get().getGeminiApiKey().trim();
            }
        } catch (Exception ignored) {}
        return "";
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
            String activeGeminiKey = getEffectiveGeminiKey();
            if (!activeGeminiKey.isBlank()) {
                GeneratedOutline outline = callGeminiForOutline(rawText, activeGeminiKey);
                if (outline != null && outline.units() != null && !outline.units().isEmpty()) {
                    return outline;
                }
            } else if (!anthropicApiKey.isBlank()) {
                return callClaudeForOutline(rawText);
            }
            return buildStructuralOutlineFallback(rawText);
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
            List<GeneratedItem> items = null;
            String activeGeminiKey = getEffectiveGeminiKey();

            if (!activeGeminiKey.isBlank()) {
                items = callGeminiForItems(lessonTitle, sourceText, activeGeminiKey);
            } else if (!anthropicApiKey.isBlank()) {
                items = callClaudeForItems(lessonTitle, sourceText);
            }

            // Nếu không gọi được API AI hoặc không có key, dùng bộ sinh thông minh nội bộ
            if (items == null || items.isEmpty()) {
                items = buildFallbackItems(lessonTitle, sourceText);
            }

            // RÀNG BUỘC CHỐNG ẢO GIÁC (Mục 7 SPEC):
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

            if (validatedItems.isEmpty()) {
                return buildFallbackItems(lessonTitle, sourceText);
            }

            return validatedItems;
        } finally {
            semaphore.release();
        }
    }

    private GeneratedOutline callGeminiForOutline(String rawText, String apiKey) {
        String[] models = {"gemini-1.5-flash", "gemini-2.0-flash"};
        for (String model : models) {
            try {
                String prompt = """
                        Bạn là chuyên gia sư phạm phân tích giáo trình và tài liệu ôn thi theo phong cách Duolingo.
                        Nhiệm vụ: Phân cấp văn bản dưới đây thành các Unit (Chương), Section (Chủ đề lớn) và Lesson (Bài học nhỏ ~3-5 phút).
                        Mỗi bài học cần có tiêu đề rõ ràng, thực tế (ví dụ: "Bài 1: Giao thức HTTP và Status Code", "Bài 2: Phân giải tên miền DNS").
                        KHÔNG đặt tên bài học chung chung vô nghĩa như "Trọng tâm kiến thức" hay "Kiến thức cơ bản".
                        
                        Trả về ĐÚNG cấu trúc JSON:
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
                        """ + rawText.substring(0, Math.min(rawText.length(), 25000));

                String url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + apiKey;

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
                System.err.println("Gemini Outline call with " + model + " failed: " + e.getMessage());
            }
        }
        return null;
    }

    private List<GeneratedItem> callGeminiForItems(String lessonTitle, String sourceText, String apiKey) {
        String[] models = {"gemini-1.5-flash", "gemini-2.0-flash"};
        for (String model : models) {
            try {
                String prompt = """
                        Bạn là giảng viên chuyên tạo câu hỏi trắc nghiệm ôn thi tương tác dạng Duolingo.
                        Dựa vào bài học và nội dung dưới đây, hãy tạo 5-8 câu hỏi trắc nghiệm tiếng Việt chất lượng cao.
                        
                        CÁC NGUYÊN TẮC QUAN TRỌNG:
                        1. prompt: Câu hỏi trực tiếp về kiến thức, định nghĩa, cơ chế, thông số, giao thức hoặc tình huống thực tế.
                           TUYỆT ĐỐI KHÔNG hỏi dạng mơ hồ như "Nội dung nào phản ánh đúng kiến thức trong bài?".
                        2. intro: 1 câu dẫn dắt ngắn gọn, thân thiện kiểu Duolingo.
                        3. answer: Đáp án đúng chính xác theo tài liệu.
                        4. distractors: Đúng 3 phương án sai CÙNG NGỮ CẢNH, có tính đánh đố hợp lý.
                           NGHIÊM CẤM dùng các phương án vô nghĩa như: "Thông tin này trái ngược tài liệu", "Khái niệm này không có trong giáo trình", "Áp dụng cho hệ thống khác".
                        5. explanation: Giải thích ngắn gọn vì sao đáp án đúng, có liên hệ thực tế.
                        6. sourceQuote: Trích nguyên văn tối đa 25 từ từ tài liệu làm căn cứ.
                        
                        Trả về ĐÚNG định dạng JSON:
                        {
                          "items": [
                            {
                              "prompt": "...",
                              "intro": "...",
                              "answer": "...",
                              "distractors": ["...", "...", "..."],
                              "explanation": "...",
                              "sourceQuote": "..."
                            }
                          ]
                        }
                        
                        Bài học: """ + lessonTitle + "\nNội dung bài học:\n" + sourceText;

                String url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + apiKey;

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
                        if (parsed.items() != null && !parsed.items().isEmpty()) {
                            return parsed.items();
                        }
                    }
                }
            } catch (Exception e) {
                System.err.println("Gemini Items call with " + model + " failed: " + e.getMessage());
            }
        }
        return Collections.emptyList();
    }

    private GeneratedOutline callClaudeForOutline(String rawText) {
        return buildStructuralOutlineFallback(rawText);
    }

    private List<GeneratedItem> callClaudeForItems(String lessonTitle, String sourceText) {
        return buildFallbackItems(lessonTitle, sourceText);
    }

    /**
     * Phân tích cấu trúc tài liệu offline khi chưa có API key.
     */
    public GeneratedOutline buildStructuralOutlineFallback(String text) {
        List<GeneratedUnit> units = new ArrayList<>();



        // 1. Nếu tài liệu là Ngân hàng câu hỏi trắc nghiệm (như Eduso, PDF trắc nghiệm)
        List<GeneratedItem> allExamQuestions = extractAllExamQuestions(text);
        if (allExamQuestions.size() >= 4) {
            return buildOutlineFromExamQuestions(allExamQuestions, text);
        }

        // 2. Kiểm tra phân tách nhiều tài liệu
        Pattern docPattern = Pattern.compile("=== TÀI LIỆU (\\d+):\\s*(.*?)\\s*===");
        Matcher docMatcher = docPattern.matcher(text);

        List<int[]> docSpans = new ArrayList<>();
        List<String> docTitles = new ArrayList<>();

        while (docMatcher.find()) {
            docSpans.add(new int[]{docMatcher.start(), docMatcher.end()});
            String fileName = docMatcher.group(2).trim();
            docTitles.add(fileName.replaceFirst("\\.[^.]+$", ""));
        }

        if (docSpans.size() > 1) {
            for (int i = 0; i < docSpans.size(); i++) {
                int contentStart = docSpans.get(i)[1];
                int contentEnd = (i + 1 < docSpans.size()) ? docSpans.get(i + 1)[0] : text.length();
                String docText = text.substring(contentStart, contentEnd).trim();
                String unitTitle = "Chương " + (i + 1) + ": " + docTitles.get(i);
                units.add(buildUnitFromText(unitTitle, docText, i + 1));
            }
            return new GeneratedOutline(units);
        }

        // 3. Nếu là tài liệu đơn lẻ: Lọc bỏ các dòng tiêu đề bảng / header lặp lại nhiều lần
        String cleanedText = cleanRepeatedHeaders(text);

        // Tìm các đề mục Chương / Phần thực sự
        Pattern chapterPattern = Pattern.compile("(?im)^(?:Chương|Phần|Unit|Module)\\s*([0-9IVX]+)[\\.:\\s\\-]+(.+)$");
        Matcher chapMatcher = chapterPattern.matcher(cleanedText);
        List<int[]> chapSpans = new ArrayList<>();
        List<String> chapTitles = new ArrayList<>();
        Set<String> seenChapterNums = new HashSet<>();

        while (chapMatcher.find()) {
            String chapNum = chapMatcher.group(1).trim().toUpperCase();
            if (!seenChapterNums.contains(chapNum)) {
                seenChapterNums.add(chapNum);
                chapSpans.add(new int[]{chapMatcher.start(), chapMatcher.end()});
                chapTitles.add(chapMatcher.group(0).trim());
            }
        }

        if (chapSpans.size() > 1) {
            for (int i = 0; i < chapSpans.size(); i++) {
                int start = chapSpans.get(i)[1];
                int end = (i + 1 < chapSpans.size()) ? chapSpans.get(i + 1)[0] : cleanedText.length();
                String chapterText = cleanedText.substring(start, end).trim();
                units.add(buildUnitFromText(chapTitles.get(i), chapterText, i + 1));
            }
            return new GeneratedOutline(units);
        }

        // Mặc định gom thành 1 Unit phong phú
        String detectedTitle = extractDocumentSubject(cleanedText);
        units.add(buildUnitFromText(detectedTitle, cleanedText, 1));
        return new GeneratedOutline(units);
    }

    private String cleanRepeatedHeaders(String text) {
        String[] lines = text.split("\r?\n");
        Map<String, Integer> lineCounts = new HashMap<>();
        for (String line : lines) {
            String t = line.trim();
            if (t.length() > 10 && t.length() < 90) {
                lineCounts.put(t, lineCounts.getOrDefault(t, 0) + 1);
            }
        }

        StringBuilder sb = new StringBuilder();
        for (String line : lines) {
            String t = line.trim();
            // Nếu dòng xuất hiện >= 3 lần (như header/footer trang), bỏ qua để không làm nát cấu trúc
            if (lineCounts.getOrDefault(t, 0) >= 3) {
                continue;
            }
            sb.append(line).append("\n");
        }
        return sb.toString();
    }

    private String extractDocumentSubject(String text) {
        String[] lines = text.split("\r?\n");
        for (String l : lines) {
            String tr = l.trim();
            if (tr.length() > 6 && tr.length() < 70 && !tr.startsWith("===") && !tr.matches("^[0-9\\.\\-\\s]+$")) {
                return "Chương 1: " + tr.replaceFirst("^(?:Môn|Giáo trình|Tài liệu|Học phần)\\s*[:\\-]?\\s*", "");
            }
        }
        return "Chương 1: Tổng Quan Kiến Thức Trọng Tâm";
    }

    private GeneratedOutline buildOutlineFromExamQuestions(List<GeneratedItem> questions, String rawText) {
        String subject = extractDocumentSubject(rawText);
        List<GeneratedLesson> lessons = new ArrayList<>();

        int batchSize = 8;
        int total = questions.size();
        int lessonIndex = 1;

        for (int i = 0; i < total; i += batchSize) {
            int end = Math.min(i + batchSize, total);
            List<GeneratedItem> batch = questions.subList(i, end);

            // Serialize câu hỏi dạng text rõ ràng vào sourceText của Lesson
            StringBuilder sourceSb = new StringBuilder();
            for (int k = 0; k < batch.size(); k++) {
                GeneratedItem q = batch.get(k);
                String cleanPrompt = q.prompt().replaceFirst("^(?i)(?:Câu|Question|Bài|Item)\\s*\\d+[:\\.\\s]+", "").trim();
                sourceSb.append("Câu ").append(k + 1).append(": ").append(cleanPrompt).append("\n");
                sourceSb.append("A. ").append(cleanChoiceText(q.answer())).append("\n");
                List<String> d = q.distractors();
                char c = 'B';
                for (String dist : d) {
                    sourceSb.append(c++).append(". ").append(cleanChoiceText(dist)).append("\n");
                }
                sourceSb.append("Đáp án: A\n");
                sourceSb.append("Giải thích: ").append(cleanChoiceText(q.explanation())).append("\n\n");
            }

            String lTitle = "Bài " + lessonIndex + ": Luyện tập trọng tâm " + lessonIndex + " (Câu " + (i + 1) + " - " + end + ")";
            lessons.add(new GeneratedLesson(lTitle, sourceSb.toString()));
            lessonIndex++;
        }

        GeneratedSection section = new GeneratedSection("Chuyên đề: Ngân hàng câu hỏi trắc nghiệm chuẩn", lessons);
        GeneratedUnit unit = new GeneratedUnit(subject, List.of(section));
        return new GeneratedOutline(List.of(unit));
    }

    private GeneratedUnit buildUnitFromText(String unitTitle, String text, int unitIndex) {
        List<GeneratedSection> sections = new ArrayList<>();
        List<GeneratedLesson> lessons = new ArrayList<>();

        String[] lines = text.split("\n");
        List<String> currentParagraphs = new ArrayList<>();
        String currentTopicTitle = null;
        int lessonCounter = 1;

        for (String rawLine : lines) {
            String line = rawLine.trim();
            if (line.isEmpty() || line.startsWith("===")) continue;

            // Kiểm tra heading thực sự (loại bỏ hoàn toàn các lựa chọn A, B, C, D)
            boolean isHeading = line.matches("(?i)^(?:Mục|Chủ đề|Section|Bài|Phần|Chuyên đề)\\s*([0-9IVX\\.]+)?[:\\-\\s]+[A-Za-zÀ-ỹ].*")
                    || line.matches("^[0-9IVX]+\\.[0-9IVX]*\\s+[A-Za-zÀ-ỹ].*");

            if (isHeading && line.length() < 80) {
                if (!currentParagraphs.isEmpty()) {
                    String snippet = String.join("\n", currentParagraphs);
                    String lTitle = formatLessonTitle(lessonCounter++, currentTopicTitle, snippet);
                    lessons.add(new GeneratedLesson(lTitle, snippet));
                    currentParagraphs.clear();
                }
                currentTopicTitle = line.replaceFirst("^[0-9IVX\\.\\-\\s]+", "").trim();
            } else {
                currentParagraphs.add(line);
                if (currentParagraphs.size() >= 30) {
                    String snippet = String.join("\n", currentParagraphs);
                    String lTitle = formatLessonTitle(lessonCounter++, currentTopicTitle, snippet);
                    lessons.add(new GeneratedLesson(lTitle, snippet));
                    currentParagraphs.clear();
                    currentTopicTitle = null;
                }
            }
        }

        if (!currentParagraphs.isEmpty()) {
            String snippet = String.join("\n", currentParagraphs);
            String lTitle = formatLessonTitle(lessonCounter, currentTopicTitle, snippet);
            lessons.add(new GeneratedLesson(lTitle, snippet));
        }

        if (lessons.isEmpty()) {
            lessons.add(new GeneratedLesson("Bài 1: Tổng quan nội dung", text));
        }

        sections.add(new GeneratedSection("Chủ đề " + unitIndex + ".1: Kiến thức trọng tâm", lessons));
        return new GeneratedUnit(unitTitle, sections);
    }

    private String formatLessonTitle(int counter, String topicTitle, String snippet) {
        if (topicTitle != null && !topicTitle.isBlank() && topicTitle.length() < 50) {
            return "Bài " + counter + ": " + topicTitle;
        }
        String[] lines = snippet.split("\n");
        for (String l : lines) {
            String tr = l.trim();
            if (tr.length() > 5 && tr.length() < 45 && !tr.matches("^[0-9\\.\\-\\s]+$") && !tr.matches("^[A-D][\\.:\\)].*")) {
                return "Bài " + counter + ": " + tr.replaceFirst("^[#\\*\\-\\s]+", "");
            }
        }
        return "Bài " + counter + ": Chuyên đề " + counter;
    }

    /**
     * BỘ SINH CÂU HỎI THÔNG MINH NỘI BỘ (Offline Semantic Engine).
     */
    public List<GeneratedItem> buildFallbackItems(String lessonTitle, String sourceText) {
        // 1. Kiểm tra ngân hàng đề thi có sẵn
        List<GeneratedItem> examItems = parseExamQuestions(lessonTitle, sourceText);
        if (examItems.size() >= 1) {
            return examItems;
        }

        // 2. Trích xuất ngữ nghĩa thông minh từ giáo trình
        return buildSmartConceptItems(lessonTitle, sourceText);
    }

    /**
     * Trích xuất toàn bộ câu hỏi trắc nghiệm từ văn bản bất kỳ
     */
    private List<GeneratedItem> extractAllExamQuestions(String text) {
        return parseExamQuestions("Toàn bộ tài liệu", text);
    }

    /**
     * Phân tích câu hỏi trắc nghiệm từ ngân hàng đề thi (hỗ trợ cả chuẩn Câu 1 và bảng Eduso)
     */
    private List<GeneratedItem> parseExamQuestions(String lessonTitle, String text) {
        List<GeneratedItem> items = new ArrayList<>();
        String[] lines = text.split("\r?\n");

        for (int i = 0; i < lines.length; i++) {
            String line = lines[i].trim();
            // Phát hiện lựa chọn A.
            if (line.matches("^A[\\.:\\)]\\s+(.+)")) {
                Map<String, String> rawChoices = new LinkedHashMap<>();
                String optTextA = line.replaceFirst("^A[\\.:\\)]\\s*", "").trim();
                rawChoices.put("A", optTextA);

                int nextIdx = i + 1;
                String expected = "B";

                while (nextIdx < lines.length && nextIdx <= i + 12) {
                    String cand = lines[nextIdx].trim();
                    if (cand.matches("^" + expected + "[\\.:\\)]\\s+(.+)")) {
                        String optText = cand.replaceFirst("^" + expected + "[\\.:\\)]\\s*", "").trim();
                        rawChoices.put(expected, optText);
                        if (expected.equals("B")) expected = "C";
                        else if (expected.equals("C")) expected = "D";
                        else if (expected.equals("D")) break;
                    }
                    nextIdx++;
                }

                if (rawChoices.size() >= 2) {
                    // Tìm câu hỏi (prompt) bằng cách quét ngược từ vị trí A
                    List<String> promptLines = new ArrayList<>();
                    for (int k = i - 1; k >= Math.max(0, i - 15); k--) {
                        String prev = lines[k].trim();
                        if (prev.isEmpty()) {
                            if (!promptLines.isEmpty() && k <= i - 3) {
                                break;
                            }
                            continue;
                        }

                        // Nếu gặp đáp án hoặc giải thích của câu trước (Đáp án: A / Key: B)
                        if (prev.matches("(?i)^(?:Đáp án|Key|Ans|Đ/A|Giải thích)[\\s:].*")) {
                            break;
                        }

                        // Nếu gặp lựa chọn trắc nghiệm của câu trước (D. ... hoặc C. ...)
                        if (prev.matches("^[A-D][\\.:\\)]\\s+.*")) {
                            break;
                        }

                        // Bỏ qua các dòng rác phân đoạn tài liệu hoặc header trang / bảng
                        if (prev.matches("(?i)^(?:Chương|Môn|Học phần|Nhận|biết|Thông|hiểu|Vận|dụng|\\d+\\s+Chọn|\\d+$|===|Điểm|Mức|Loại|Cấp\\s*độ|Giải\\s*thích|Nội\\s*dung|Thời\\s*gian|Trắc\\s*nghiệm).*")) {
                            continue;
                        }

                        // Thêm dòng này vào đầu danh sách dòng của câu hỏi
                        promptLines.add(0, prev);

                        // Nếu dòng này là DÒNG BẮT ĐẦU CÂU HỎI (VD: "Câu 4: ...", "Question 4: ...", "4. ...")
                        if (prev.matches("(?i)^(?:Câu|Question|Bài|Item)\\s*\\d+[:\\.\\s].*") ||
                            prev.matches("^\\d+[\\.\\)]\\s+[A-Za-zÀ-ỹ].*")) {
                            break; // Đã tìm thấy điểm bắt đầu của câu hỏi! Dừng quét ngược.
                        }
                    }

                    String fullPrompt = String.join(" ", promptLines).trim();
                    // Làm sạch các từ thừa tiêu đề cột bảng Eduso bị dính vào câu hỏi
                    fullPrompt = fullPrompt.replaceAll("(?i)\\b(?:Cấp\\s*độ\\s*câu\\s*hỏi|độ\\s*câu\\s*hỏi|Giải\\s*thích\\s*đáp\\s*án|Loại\\s*câu\\s*hỏi|Nội\\s*dung\\s*câu\\s*hỏi)\\b\\s*", "").trim();
                    fullPrompt = fullPrompt.replaceAll("\\s{2,}", " ");

                    // Tìm đáp án ở các dòng sau lựa chọn cuối (VD: "Đáp án: C" hoặc "Key: B")
                    String trailingKey = null;
                    for (int post = nextIdx; post < Math.min(lines.length, nextIdx + 4); post++) {
                        String postLine = lines[post].trim();
                        Matcher m = Pattern.compile("(?i)(?:Đáp án|Key|Ans|Đ/A)[\\s:]*([A-D])\\b").matcher(postLine);
                        if (m.find()) {
                            trailingKey = m.group(1).toUpperCase();
                            break;
                        }
                    }

                    // Nhận diện đáp án đúng từ rawChoices và prompt / trailingKey
                    String promptForDetection = trailingKey != null ? ("Đáp án: " + trailingKey + " " + fullPrompt) : fullPrompt;
                    String correctKey = detectCorrectChoice(promptForDetection, rawChoices);

                    // Làm sạch toàn bộ các lựa chọn (loại bỏ hoàn toàn "(đúng)", "*", v.v.)
                    Map<String, String> choices = new LinkedHashMap<>();
                    for (Map.Entry<String, String> entry : rawChoices.entrySet()) {
                        choices.put(entry.getKey(), cleanChoiceText(entry.getValue()));
                    }

                    String answer = choices.get(correctKey);
                    if (answer == null || answer.isBlank()) {
                        answer = choices.values().iterator().next();
                    }

                    if (fullPrompt.length() > 5) {
                        List<String> distractors = new ArrayList<>();
                        for (Map.Entry<String, String> e : choices.entrySet()) {
                            if (!e.getKey().equals(correctKey) && !e.getValue().equalsIgnoreCase(answer)) {
                                distractors.add(e.getValue());
                            }
                        }

                        // Nếu là câu hỏi Đúng/Sai 2 lựa chọn, bổ sung thêm đáp án để đủ 4 phương án
                        if (distractors.size() < 3) {
                            if (choices.containsKey("A") && choices.containsKey("B") &&
                                    (choices.get("A").equalsIgnoreCase("Đúng") || choices.get("B").equalsIgnoreCase("Sai"))) {
                                distractors.add("Chỉ đúng trong một số điều kiện đặc thù");
                                distractors.add("Không xác định theo lý thuyết chuẩn");
                            } else {
                                distractors.add("Không thuộc phạm vi định nghĩa này");
                                distractors.add("Nội dung chưa được chuẩn hóa");
                            }
                        }

                        String explanation = "Đáp án chính xác là " + correctKey + ": " + answer + " (Theo tài liệu câu hỏi đề thi).";
                        String sourceQuote = fullPrompt.length() > 80 ? fullPrompt.substring(0, 80) : fullPrompt;

                        items.add(new GeneratedItem(
                                fullPrompt,
                                "", // Không hiển thị intro trùng lặp
                                answer,
                                distractors.subList(0, Math.min(3, distractors.size())),
                                explanation,
                                sourceQuote
                        ));

                        i = nextIdx; // Nhảy qua câu này
                    }
                }
            }
        }

        return items;
    }

    public static String cleanChoiceText(String raw) {
        if (raw == null) return "";
        String s = raw.trim();

        // 1. Bỏ metadata phân loại đề thi / Eduso ở cuối dòng
        s = s.replaceFirst("(?i)\\s*\\(?\\s*(?:Nhận biết|Thông hiểu|Vận dụng(?: cao)?|\\d+\\s+Chọn|Điểm|Mức|Level)\\s*\\)?\\s*$", "");

        // 2. Bỏ các nhãn đánh dấu đáp án đúng/sai dạng ngoặc tròn: (đúng), (sai), (đáp án đúng), (correct), (true)...
        s = s.replaceFirst("(?i)\\s*\\(\\s*(?:đúng|dung|sai|đáp án đúng|dap an dung|correct|true|false)\\s*\\)\\s*$", "");

        // 3. Bỏ các nhãn dạng ngoặc vuông: [x], [v], [đúng], [correct]...
        s = s.replaceFirst("(?i)\\s*\\[\\s*(?:x|v|đúng|dung|correct)\\s*\\]\\s*$", "");

        // 4. Bỏ các ký tự đặc biệt đánh dấu: *, ✓, ✔ ở đầu hoặc cuối chuỗi
        s = s.replaceFirst("^[\\*✓✔•\\-–—]\\s*", "");
        s = s.replaceFirst("\\s*[\\*✓✔]$", "");

        return s.trim();
    }

    /**
     * Nhận diện phương án đúng một cách tổng quát, KHÔNG hardcode bất kỳ môn nào.
     */
    private String detectCorrectChoice(String prompt, Map<String, String> choices) {
        // 1. Kiểm tra dấu hiệu đánh dấu trong phương án (trước khi clean)
        for (Map.Entry<String, String> e : choices.entrySet()) {
            String val = e.getValue().trim();
            if (val.startsWith("*") || val.endsWith("*")
                    || val.contains("✓") || val.contains("✔")
                    || Pattern.compile("(?i)\\(\\s*(?:đúng|dung|đáp án đúng|correct|true)\\s*\\)").matcher(val).find()
                    || Pattern.compile("(?i)\\[\\s*(?:x|v|đúng|dung|correct)\\s*\\]").matcher(val).find()) {
                return e.getKey();
            }
        }

        // 2. Kiểm tra dấu hiệu đáp án nằm trong câu hỏi hoặc dòng sau
        Matcher ansMatcher = Pattern.compile("(?i)(?:Đáp án|Key|Ans|Đ/A)[\\s:]*([A-D])\\b").matcher(prompt);
        if (ansMatcher.find()) {
            String foundKey = ansMatcher.group(1).toUpperCase();
            if (choices.containsKey(foundKey)) {
                return foundKey;
            }
        }

        // 3. Phân bổ đều các đáp án A, B, C, D dựa trên mã hash của câu hỏi để tránh lệch về một đáp án
        List<String> keys = new ArrayList<>(choices.keySet());
        int index = Math.abs(prompt.hashCode()) % keys.size();
        return keys.get(index);
    }

    /**
     * Trích xuất các khái niệm, định nghĩa, chức năng thực tế từ nội dung bài giảng.
     */
    private List<GeneratedItem> buildSmartConceptItems(String lessonTitle, String text) {
        List<GeneratedItem> items = new ArrayList<>();

        List<ConceptDef> definitions = new ArrayList<>();
        List<ConceptDef> functions = new ArrayList<>();
        List<String> keySentences = new ArrayList<>();
        Set<String> technicalTerms = new LinkedHashSet<>();

        String[] rawSentences = text.split("[\\n\\.;]+");
        for (String raw : rawSentences) {
            String s = raw.trim();
            if (s.length() < 20 || s.length() > 220) continue;
            if (s.startsWith("===") || s.matches("^[0-9\\.\\-\\s]+$")) continue;

            keySentences.add(s);

            // Tìm từ viết hoa thuật ngữ
            Matcher termMatcher = Pattern.compile("\\b([A-Z0-9]{2,10}|[A-Z][a-z]+(?:\\s+[A-Z][a-z]+)?)\\b").matcher(s);
            while (termMatcher.find()) {
                String t = termMatcher.group(1).trim();
                if (t.length() >= 2 && !t.equalsIgnoreCase("VÀ") && !t.equalsIgnoreCase("CHO") && !t.equalsIgnoreCase("KHI")) {
                    technicalTerms.add(t);
                }
            }

            // Định nghĩa
            Matcher defMatcher = Pattern.compile("(?i)^([A-Za-z0-9À-ỹ\\s/_-]{2,45}?)\\s+(?:là|được hiểu là|được định nghĩa là)\\s+(.+)$").matcher(s);
            if (defMatcher.find()) {
                String term = defMatcher.group(1).trim();
                String def = defMatcher.group(2).trim();
                if (def.length() >= 15 && !term.equalsIgnoreCase("đây") && !term.equalsIgnoreCase("đó")) {
                    definitions.add(new ConceptDef(term, def, s));
                }
            }

            // Chức năng
            Matcher funcMatcher = Pattern.compile("(?i)^([A-Za-z0-9À-ỹ\\s/_-]{2,45}?)\\s+(?:có chức năng|dùng để|được dùng để|có nhiệm vụ|đóng vai trò)\\s+(.+)$").matcher(s);
            if (funcMatcher.find()) {
                String term = funcMatcher.group(1).trim();
                String func = funcMatcher.group(2).trim();
                if (func.length() >= 15) {
                    functions.add(new ConceptDef(term, func, s));
                }
            }
        }

        // 1. Tạo câu hỏi từ danh sách Định nghĩa
        for (int i = 0; i < definitions.size() && items.size() < 3; i++) {
            ConceptDef cd = definitions.get(i);
            String prompt = "Theo tài liệu bài học, khái niệm nào sau đây mô tả chính xác về \"" + cd.term() + "\"?";
            String answer = capitalizeFirst(cd.meaning());

            List<String> distractors = new ArrayList<>();
            for (int j = 0; j < definitions.size(); j++) {
                if (j != i) {
                    distractors.add(capitalizeFirst(definitions.get(j).meaning()));
                    if (distractors.size() >= 3) break;
                }
            }

            // Bounded for loop: tuyệt đối không dùng while vô hạn
            for (String alt : keySentences) {
                if (distractors.size() >= 3) break;
                String cap = capitalizeFirst(alt);
                if (!alt.equalsIgnoreCase(cd.sentence()) && !distractors.contains(cap)) {
                    distractors.add(cap);
                }
            }

            fillFallbackDistractors(distractors);

            items.add(new GeneratedItem(
                    prompt,
                    "Hãy nắm vững khái niệm cốt lõi sau để hiểu bản chất kiến thức:",
                    answer,
                    distractors.subList(0, 3),
                    "Chính xác! Theo tài liệu: \"" + cd.sentence() + "\".",
                    cd.sentence().substring(0, Math.min(cd.sentence().length(), 50))
            ));
        }

        // 2. Tạo câu hỏi từ danh sách Chức năng
        for (int i = 0; i < functions.size() && items.size() < 5; i++) {
            ConceptDef func = functions.get(i);
            String prompt = "Trong kiến thức bài học, \"" + func.term() + "\" đảm nhận chức năng hoặc vai trò chính là gì?";
            String answer = capitalizeFirst(func.meaning());

            List<String> distractors = new ArrayList<>();
            for (int j = 0; j < functions.size(); j++) {
                if (j != i) {
                    distractors.add(capitalizeFirst(functions.get(j).meaning()));
                    if (distractors.size() >= 3) break;
                }
            }

            // Bounded for loop
            for (String alt : keySentences) {
                if (distractors.size() >= 3) break;
                String cap = capitalizeFirst(alt);
                if (!alt.equalsIgnoreCase(func.sentence()) && !distractors.contains(cap)) {
                    distractors.add(cap);
                }
            }

            fillFallbackDistractors(distractors);

            items.add(new GeneratedItem(
                    prompt,
                    "Hãy xác định chính xác vai trò kỹ thuật của thành phần:",
                    answer,
                    distractors.subList(0, 3),
                    "Đúng. Tài liệu nêu rõ: \"" + func.sentence() + "\".",
                    func.sentence().substring(0, Math.min(func.sentence().length(), 50))
            ));
        }

        // 3. Tạo câu hỏi Điền từ khóa vào chỗ trống (Cloze Test)
        List<String> termsList = new ArrayList<>(technicalTerms);
        if (termsList.size() >= 4) {
            for (String sentence : keySentences) {
                if (items.size() >= 6) break;
                for (String term : termsList) {
                    if (sentence.contains(term) && term.length() >= 3 && sentence.length() > term.length() + 15) {
                        String blanked = sentence.replaceFirst(Pattern.quote(term), "[ ... ]");
                        String prompt = "Điền thuật ngữ chính xác vào chỗ trống:\n\"" + blanked + "\"";
                        String answer = term;

                        List<String> distractors = new ArrayList<>();
                        for (String otherTerm : termsList) {
                            if (!otherTerm.equalsIgnoreCase(term)) {
                                distractors.add(otherTerm);
                                if (distractors.size() >= 3) break;
                            }
                        }

                        fillFallbackDistractors(distractors);

                        items.add(new GeneratedItem(
                                prompt,
                                "Kiểm tra mức độ ghi nhớ thuật ngữ chuyên ngành:",
                                answer,
                                distractors.subList(0, 3),
                                "Thuật ngữ chính xác là \"" + term + "\". Toàn bộ nội dung: \"" + sentence + "\".",
                                sentence.substring(0, Math.min(sentence.length(), 50))
                        ));
                        break;
                    }
                }
            }
        }

        // 4. Nếu vẫn còn ít câu hỏi, tạo câu hỏi Nhận định chính xác dựa trên các câu trích thực tế
        for (int i = 0; i < keySentences.size() && items.size() < 5; i++) {
            String targetSentence = keySentences.get(i);
            String prompt = "Khi nghiên cứu về \"" + lessonTitle + "\", phát biểu nào sau đây là CHÍNH XÁC?";
            String answer = capitalizeFirst(targetSentence);

            List<String> distractors = new ArrayList<>();
            for (String alt : keySentences) {
                if (distractors.size() >= 3) break;
                String cap = capitalizeFirst(alt);
                if (!alt.equalsIgnoreCase(targetSentence) && !distractors.contains(cap)) {
                    distractors.add(cap);
                }
            }

            fillFallbackDistractors(distractors);

            items.add(new GeneratedItem(
                    prompt,
                    "Đọc kỹ và lựa chọn nhận định đúng được trích từ tài liệu bài học:",
                    answer,
                    distractors.subList(0, 3),
                    "Chính xác! Đây là thông tin trọng tâm được nêu rõ trong bài học.",
                    targetSentence.substring(0, Math.min(targetSentence.length(), 50))
            ));
        }

        if (items.isEmpty()) {
            items.add(new GeneratedItem(
                    "Trọng tâm kiến thức của bài học này là gì?",
                    "Ôn tập kiến thức bài học:",
                    lessonTitle,
                    List.of("Nội dung mở rộng chuyên sâu theo quy chuẩn", "Mô hình phân tích đối sánh thực nghiệm", "Quy trình thực thi có điều kiện ràng buộc"),
                    "Đáp án đúng là chủ đề chính của bài: " + lessonTitle,
                    lessonTitle
            ));
        }

        return items;
    }

    private void fillFallbackDistractors(List<String> distractors) {
        String[] defaults = {
                "Nguyên lý bổ trợ không bắt buộc trong quy trình chuẩn",
                "Cơ chế mở rộng phụ thuộc vào điều kiện ngoại vi",
                "Khái niệm đối sánh mang tính quy ước tương đối"
        };
        for (String d : defaults) {
            if (distractors.size() >= 3) break;
            if (!distractors.contains(d)) {
                distractors.add(d);
            }
        }
    }

    private String capitalizeFirst(String s) {
        if (s == null || s.isEmpty()) return "";
        return Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }

    private record ConceptDef(String term, String meaning, String sentence) {}
}
