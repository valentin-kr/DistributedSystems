package de.htw.chatroomapi.service;

public class InvalidJoinCodeException extends RuntimeException {
    public InvalidJoinCodeException(String code) {
        super("No chatroom found for join code " + code);
    }
}
