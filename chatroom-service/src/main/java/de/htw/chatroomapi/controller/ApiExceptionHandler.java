package de.htw.chatroomapi.controller;

import de.htw.chatroomapi.dto.ApiErrorResponse;
import de.htw.chatroomapi.service.ChatroomExpiredException;
import de.htw.chatroomapi.service.ChatroomNotFoundException;
import de.htw.chatroomapi.service.InvalidJoinCodeException;
import de.htw.chatroomapi.service.NotChatroomMemberException;
import de.htw.chatroomapi.service.NotChatroomOwnerException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.LocalDateTime;

@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(ChatroomNotFoundException.class)
    public ResponseEntity<ApiErrorResponse> handleNotFound(ChatroomNotFoundException exception) {
        return error(HttpStatus.NOT_FOUND, exception.getMessage());
    }

    @ExceptionHandler(ChatroomExpiredException.class)
    public ResponseEntity<ApiErrorResponse> handleExpired(ChatroomExpiredException exception) {
        return error(HttpStatus.CONFLICT, exception.getMessage());
    }

    @ExceptionHandler(NotChatroomMemberException.class)
    public ResponseEntity<ApiErrorResponse> handleNotMember(NotChatroomMemberException exception) {
        return error(HttpStatus.FORBIDDEN, exception.getMessage());
    }

    @ExceptionHandler(NotChatroomOwnerException.class)
    public ResponseEntity<ApiErrorResponse> handleNotOwner(NotChatroomOwnerException exception) {
        return error(HttpStatus.FORBIDDEN, exception.getMessage());
    }

    @ExceptionHandler(InvalidJoinCodeException.class)
    public ResponseEntity<ApiErrorResponse> handleInvalidJoinCode(InvalidJoinCodeException exception) {
        return error(HttpStatus.NOT_FOUND, exception.getMessage());
    }

    private ResponseEntity<ApiErrorResponse> error(HttpStatus status, String message) {
        ApiErrorResponse response = new ApiErrorResponse(
                LocalDateTime.now(),
                status.value(),
                status.getReasonPhrase(),
                message);
        return ResponseEntity.status(status).body(response);
    }
}
