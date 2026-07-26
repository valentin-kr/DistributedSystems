package de.htw.chatroomapi.dto;

public record CreateChatroomRequest(
        String name,
        String description,
        long expiryHours,
        long userId) {
}
