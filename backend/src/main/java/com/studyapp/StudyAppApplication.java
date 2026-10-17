package com.studyapp;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableAsync
public class StudyAppApplication {
    public static void main(String[] args) {
        SpringApplication.run(StudyAppApplication.class, args);
    }
}
