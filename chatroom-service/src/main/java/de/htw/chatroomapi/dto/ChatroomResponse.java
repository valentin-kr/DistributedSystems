package de.htw.chatroomapi.dto;

import java.time.LocalDateTime;
import java.util.List;

public record ChatroomResponse(
        Integer id,
        String name,
        String description,
        Long seqId,
        LocalDateTime createdAt,
        LocalDateTime expiryDate,
        boolean active,
        List<Long> memberIds
) {}
