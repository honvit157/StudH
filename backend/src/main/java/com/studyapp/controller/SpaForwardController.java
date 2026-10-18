package com.studyapp.controller;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class SpaForwardController {

    @GetMapping(value = {
        "/login",
        "/path",
        "/schedule",
        "/stats",
        "/settings",
        "/session"
    })
    public String forwardSpaRoutes(HttpServletRequest request) {
        return "forward:/index.html";
    }
}
