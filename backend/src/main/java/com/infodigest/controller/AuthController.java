package com.infodigest.controller;

import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @PostMapping("/register")
    public String register() {
        return "Register success";
    }

    @PostMapping("/login")
    public String login() {
        return "JWT Token";
    }

    @PutMapping("/privacy")
    public String updatePrivacy() {
        return "Privacy updated";
    }
}
