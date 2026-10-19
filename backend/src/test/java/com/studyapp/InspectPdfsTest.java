package com.studyapp;

import com.studyapp.service.AiService;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;

import java.io.File;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@org.springframework.boot.test.context.SpringBootTest
public class InspectPdfsTest {

    @org.springframework.beans.factory.annotation.Autowired
    private com.studyapp.repository.CourseRepository courseRepo;

    @Test
    public void checkCoursesInDb() {
        if (courseRepo != null) {
            var list = courseRepo.findAll();
            System.out.println(">>> CURRENT DB COURSES COUNT: " + list.size());
            for (var c : list) {
                System.out.println(" - ID: " + c.getId() + " | Title: " + c.getTitle() + " | Created: " + c.getCreatedAt());
            }
        }
    }
}
