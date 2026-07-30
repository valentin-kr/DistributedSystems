package de.htw.chatroomapi.dto;

import java.time.Instant;

public record MediaResponse(
        Integer id,
        String filename,
        String contentType,
        Long uploaderId,
        String uploaderName,
        Instant uploadedAt
) {
}
