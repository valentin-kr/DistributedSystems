package de.htw.chatroomapi.dto;

import java.time.LocalDateTime;

public record MediaResponse(
        Integer id,
        String filename,
        String contentType,
        Long uploaderId,
        String uploaderName,
        LocalDateTime uploadedAt
) {
}
