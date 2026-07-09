package com.infodigest.controller;

import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {

    @GetMapping("/report")
    public String getReport(@RequestParam String date, @RequestParam String type) {
        // TODO: Implement logic to fetch UserReport from repository
        return "Report for " + date + " of type " + type;
    }

    @GetMapping("/reviews/today")
    public String getTodayReviews() {
        // TODO: Implement logic to fetch ReviewCards for today
        return "List of review cards for today";
    }
}
