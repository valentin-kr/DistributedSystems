package de.htw.chatroomapi.dto;

import java.time.LocalDateTime;

public record MessageResponse(
                Integer id,
                Long seqId,
                String text,
                Long authorID,
                LocalDateTime timestamp) {
}
