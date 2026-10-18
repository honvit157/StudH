package com.studyapp.service;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.apache.poi.xwpf.usermodel.XWPFTableRow;
import org.apache.poi.xwpf.usermodel.XWPFTableCell;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;

@Service
public class DocumentExtractionService {

    public record ExtractedDocument(
            String text,
            int charCount,
            String fileName,
            String fileType
    ) {}

    public ExtractedDocument extract(MultipartFile file) throws Exception {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("File tải lên không được để trống.");
        }

        String originalFilename = file.getOriginalFilename() != null ? file.getOriginalFilename() : "document.txt";
        String lowerName = originalFilename.toLowerCase();

        String text;
        String fileType;

        if (lowerName.endsWith(".pdf")) {
            fileType = "PDF";
            text = extractPdf(file.getInputStream());
        } else if (lowerName.endsWith(".docx")) {
            fileType = "DOCX";
            text = extractDocx(file.getInputStream());
        } else if (lowerName.endsWith(".txt") || lowerName.endsWith(".md")) {
            fileType = lowerName.endsWith(".md") ? "MARKDOWN" : "TEXT";
            text = new String(file.getBytes(), StandardCharsets.UTF_8);
        } else {
            throw new IllegalArgumentException("Định dạng file không được hỗ trợ. Chỉ nhận file .pdf, .docx, .txt, .md");
        }

        text = text.trim();
        if (text.isEmpty()) {
            throw new IllegalArgumentException("Không thể đọc được văn bản trong file. Nếu đây là PDF ảnh quét, vui lòng sử dụng file có văn bản thực.");
        }

        return new ExtractedDocument(text, text.length(), originalFilename, fileType);
    }

    private String extractPdf(InputStream inputStream) throws Exception {
        byte[] bytes = inputStream.readAllBytes();
        try (PDDocument document = Loader.loadPDF(bytes)) {
            PDFTextStripper stripper = new PDFTextStripper();
            String extracted = stripper.getText(document);

            // Kiểm tra nếu PDF có trang nhưng không trích xuất được chữ (ảnh quét)
            if (document.getNumberOfPages() > 0 && (extracted == null || extracted.trim().length() < 30)) {
                throw new IllegalArgumentException("PDF này là ảnh quét hoặc không chứa văn bản đọc được. Hệ thống yêu cầu file PDF chứa văn bản (text-based).");
            }
            return extracted;
        }
    }

    private String extractDocx(InputStream inputStream) throws Exception {
        StringBuilder sb = new StringBuilder();
        try (XWPFDocument document = new XWPFDocument(inputStream)) {
            for (XWPFParagraph p : document.getParagraphs()) {
                String text = p.getText();
                if (text != null && !text.isBlank()) {
                    sb.append(text).append("\n");
                }
            }
            for (XWPFTable table : document.getTables()) {
                for (XWPFTableRow row : table.getRows()) {
                    for (XWPFTableCell cell : row.getTableCells()) {
                        sb.append(cell.getText()).append(" ");
                    }
                    sb.append("\n");
                }
            }
        }
        return sb.toString();
    }
}
