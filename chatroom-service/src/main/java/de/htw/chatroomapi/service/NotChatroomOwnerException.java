package de.htw.chatroomapi.service;

public class NotChatroomOwnerException extends RuntimeException {
    public NotChatroomOwnerException(Long userId, Integer chatroomId) {
        super("User " + userId + " is not the creator of chatroom " + chatroomId);
    }
}
