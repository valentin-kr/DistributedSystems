package de.htw.chatroomapi.dto;

import java.time.LocalDateTime;

public record MessageResponse(
                Long seqId,
                String text,
                Long authorID,
                LocalDateTime timestamp) {
}
