package com.studyapp.controller;

import com.studyapp.dto.AnswerRequest;
import com.studyapp.dto.AnswerResponse;
import com.studyapp.dto.FinishSessionRequest;
import com.studyapp.dto.FinishSessionResponse;
import com.studyapp.dto.TodaySessionResponse;
import com.studyapp.service.SessionService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/session")
public class SessionController {

    private final SessionService sessionService;

    public SessionController(SessionService sessionService) {
        this.sessionService = sessionService;
    }

    @GetMapping("/today")
    public ResponseEntity<TodaySessionResponse> getTodaySession() {
        TodaySessionResponse response = sessionService.getTodaySession();
        return ResponseEntity.ok(response);
    }

    @GetMapping("/lesson/{lessonId}")
    public ResponseEntity<TodaySessionResponse> getLessonSession(@PathVariable java.util.UUID lessonId) {
        TodaySessionResponse response = sessionService.getLessonSession(lessonId);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/answer")
    public ResponseEntity<AnswerResponse> submitAnswer(@Valid @RequestBody AnswerRequest request) {
        AnswerResponse response = sessionService.processAnswer(request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/finish")
    public ResponseEntity<FinishSessionResponse> finishSession(@Valid @RequestBody FinishSessionRequest request) {
        FinishSessionResponse response = sessionService.finishSession(request);
        return ResponseEntity.ok(response);
    }
}
