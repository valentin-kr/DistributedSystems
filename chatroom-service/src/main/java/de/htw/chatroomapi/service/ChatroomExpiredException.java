package de.htw.chatroomapi.service;

public class ChatroomExpiredException extends RuntimeException {
    public ChatroomExpiredException(Integer chatroomId) {
        super("Chatroom " + chatroomId + " is expired");
    }
}
