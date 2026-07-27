package de.htw.chatroomapi.exception;

public class ChatroomExpiredException extends RuntimeException {
    public ChatroomExpiredException(String message) {
        super(message);
    }
}
