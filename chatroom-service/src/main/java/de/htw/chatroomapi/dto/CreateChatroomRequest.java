package de.htw.chatroomapi.dto;

public record CreateChatroomRequest(String name, long expiryHours, long userId, String username, String userURI) {
    public Object user() {
        return null;
    }



}
