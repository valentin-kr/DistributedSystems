package de.htw.chatroomapi.controller;

import de.htw.chatroomapi.service.ChatroomRetentionService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/admin")
public class AdminController {

    private final ChatroomRetentionService retentionService;

    public AdminController(ChatroomRetentionService retentionService) {
        this.retentionService = retentionService;
    }

    // Manually triggers the retention purge that otherwise runs hourly,
    // so it can be demoed without waiting out the real retention window.
    @PostMapping("/purge-expired-chatrooms")
    public ResponseEntity<Map<String, Integer>> purgeNow() {
        int purged = retentionService.purgeExpiredChatrooms();
        return ResponseEntity.ok(Map.of("purged", purged));
    }
}
