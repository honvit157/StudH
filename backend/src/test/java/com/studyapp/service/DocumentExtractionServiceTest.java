package com.studyapp.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.*;

public class DocumentExtractionServiceTest {

    private final DocumentExtractionService service = new DocumentExtractionService();

    @Test
    @DisplayName("Trích xuất thành công văn bản từ file text .txt và .md")
    void testExtractPlainTextAndMarkdown() throws Exception {
        String content = "Đây là nội dung tài liệu ôn tập kiến thức lập trình Web kiểu Duolingo.";
        MockMultipartFile file = new MockMultipartFile("file", "tailieu.txt", "text/plain", content.getBytes(StandardCharsets.UTF_8));

        var result = service.extract(file);
        assertEquals("TEXT", result.fileType());
        assertEquals(content, result.text());
        assertEquals(content.length(), result.charCount());

        MockMultipartFile mdFile = new MockMultipartFile("file", "readme.md", "text/markdown", content.getBytes(StandardCharsets.UTF_8));
        var mdResult = service.extract(mdFile);
        assertEquals("MARKDOWN", mdResult.fileType());
    }

    @Test
    @DisplayName("Ném ngoại lệ rõ ràng khi file rỗng")
    void testExtractEmptyFileThrowsException() {
        MockMultipartFile emptyFile = new MockMultipartFile("file", "empty.txt", "text/plain", new byte[0]);
        assertThrows(IllegalArgumentException.class, () -> service.extract(emptyFile));
    }

    @Test
    @DisplayName("Ném ngoại lệ khi định dạng file không hỗ trợ")
    void testUnsupportedFormatThrowsException() {
        MockMultipartFile exeFile = new MockMultipartFile("file", "app.exe", "application/octet-stream", "dummy".getBytes());
        assertThrows(IllegalArgumentException.class, () -> service.extract(exeFile));
    }
}
