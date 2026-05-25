package de.htw.chatroomapi.dto;

public record SendMessageRequest(Integer chatroomId, String text, Long userId, String username) {}