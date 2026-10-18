package com.studyapp.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.studyapp.dto.DataBackupDto;
import com.studyapp.dto.SettingsDto;
import com.studyapp.dto.UpdateSettingsRequest;
import com.studyapp.service.BackupRestoreService;
import com.studyapp.service.SettingsService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.util.Map;

@RestController
public class SettingsController {

    private final SettingsService settingsService;
    private final BackupRestoreService backupRestoreService;
    private final ObjectMapper objectMapper;

    public SettingsController(SettingsService settingsService,
                              BackupRestoreService backupRestoreService,
                              ObjectMapper objectMapper) {
        this.settingsService = settingsService;
        this.backupRestoreService = backupRestoreService;
        this.objectMapper = objectMapper;
    }

    @GetMapping("/api/settings")
    public ResponseEntity<SettingsDto> getSettings() {
        return ResponseEntity.ok(settingsService.getSettings());
    }

    @PutMapping("/api/settings")
    public ResponseEntity<SettingsDto> updateSettings(@RequestBody UpdateSettingsRequest request) {
        return ResponseEntity.ok(settingsService.updateSettings(request));
    }

    @GetMapping(value = "/api/export", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<DataBackupDto> exportData() {
        DataBackupDto backup = backupRestoreService.exportData();
        String filename = "studyapp-backup-" + LocalDate.now() + ".json";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .body(backup);
    }

    @PostMapping(value = "/api/import", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> importDataJson(@RequestBody DataBackupDto backup) {
        backupRestoreService.restoreData(backup);
        return ResponseEntity.ok(Map.of("status", "success", "message", "Khôi phục dữ liệu sao lưu thành công!"));
    }

    @PostMapping(value = "/api/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, Object>> importDataFile(@RequestParam("file") MultipartFile file) throws Exception {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("status", "error", "message", "File tải lên không có nội dung"));
        }
        DataBackupDto backup = objectMapper.readValue(file.getInputStream(), DataBackupDto.class);
        backupRestoreService.restoreData(backup);
        return ResponseEntity.ok(Map.of("status", "success", "message", "Khôi phục dữ liệu từ file thành công!"));
    }

    @PostMapping("/api/settings/reset")
    public ResponseEntity<Map<String, Object>> resetData() {
        backupRestoreService.resetAllData();
        return ResponseEntity.ok(Map.of("status", "success", "message", "Đã xóa toàn bộ dữ liệu và đưa về trạng thái ban đầu."));
    }
}
