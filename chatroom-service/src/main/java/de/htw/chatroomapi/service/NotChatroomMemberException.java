package de.htw.chatroomapi.service;

public class NotChatroomMemberException extends RuntimeException {
    public NotChatroomMemberException(Long userId, Integer chatroomId) {
        super("User " + userId + " is not a member of chatroom " + chatroomId);
    }
}
