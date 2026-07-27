package de.htw.chatroomapi.service;

public class ChatroomNotFoundException extends RuntimeException {
    public ChatroomNotFoundException(Integer chatroomId) {
        super("Chatroom " + chatroomId + " not found");
    }
}
