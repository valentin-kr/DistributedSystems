package de.htw.chatroomapi.dto;

import java.time.Instant;

public record MessageResponse(
                Integer id,
                Long seqId,
                String text,
                Long authorID,
                Instant timestamp) {
}
