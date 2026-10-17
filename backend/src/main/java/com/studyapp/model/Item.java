package com.studyapp.model;

import jakarta.persistence.*;
import java.util.UUID;

@Entity
@Table(name = "items")
public class Item {
    @Id
    private UUID id;

    @Column(nullable = false)
    private UUID lessonId;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String prompt;

    @Column(columnDefinition = "TEXT")
    private String intro;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String answer;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String distractors; // JSON array string e.g. ["a","b","c"]

    @Column(columnDefinition = "TEXT")
    private String explanation;

    @Column(length = 500)
    private String sourceQuote;

    public Item() {
        this.id = UUID.randomUUID();
    }

    public Item(UUID lessonId, String prompt, String intro, String answer, String distractors, String explanation, String sourceQuote) {
        this();
        this.lessonId = lessonId;
        this.prompt = prompt;
        this.intro = intro;
        this.answer = answer;
        this.distractors = distractors;
        this.explanation = explanation;
        this.sourceQuote = sourceQuote;
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getLessonId() { return lessonId; }
    public void setLessonId(UUID lessonId) { this.lessonId = lessonId; }

    public String getPrompt() { return prompt; }
    public void setPrompt(String prompt) { this.prompt = prompt; }

    public String getIntro() { return intro; }
    public void setIntro(String intro) { this.intro = intro; }

    public String getAnswer() { return answer; }
    public void setAnswer(String answer) { this.answer = answer; }

    public String getDistractors() { return distractors; }
    public void setDistractors(String distractors) { this.distractors = distractors; }

    public String getExplanation() { return explanation; }
    public void setExplanation(String explanation) { this.explanation = explanation; }

    public String getSourceQuote() { return sourceQuote; }
    public void setSourceQuote(String sourceQuote) { this.sourceQuote = sourceQuote; }
}
