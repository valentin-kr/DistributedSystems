package de.htw.chatroomapi.dto;

import java.time.LocalDateTime;

public record MessageResponse(
        Long seqId,
        String text,
        String username,
        Long authorID,
        LocalDateTime timestamp
) {}