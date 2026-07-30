package de.htw.chatroomapi.service;

public class ChatroomExpiredException extends RuntimeException {
    public ChatroomExpiredException(String chatroomName) {
        super(chatroomName + " is expired");
    }
}
