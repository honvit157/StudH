package com.studyapp.dto;

import jakarta.validation.constraints.NotBlank;

public record LoginRequest(
    @NotBlank(message = "Mật khẩu không được để trống")
    String password
) {}
