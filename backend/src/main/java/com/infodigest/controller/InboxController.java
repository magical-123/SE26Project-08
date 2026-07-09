package com.infodigest.controller;

import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/inbox")
public class InboxController {

    @GetMapping("/items")
    public String getInboxItems() {
        return "List of inbox items";
    }
}
