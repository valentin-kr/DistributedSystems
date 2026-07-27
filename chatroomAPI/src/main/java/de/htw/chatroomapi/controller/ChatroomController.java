package de.htw.chatroomapi.controller;

import de.htw.chatroomapi.dto.CreateChatroomRequest;
import de.htw.chatroomapi.dto.MessageResponse;
import de.htw.chatroomapi.dto.SendMessageRequest;
import de.htw.chatroomapi.exception.ChatroomExpiredException;
import de.htw.chatroomapi.model.Chatroom;
import de.htw.chatroomapi.model.Message;
import de.htw.chatroomapi.service.ChatroomService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/chatrooms")
public class ChatroomController {

    private final ChatroomService chatroomService;

    public ChatroomController(ChatroomService chatroomService) {
        this.chatroomService = chatroomService;
    }

    // POST /chatrooms
    @PostMapping
    public ResponseEntity<Chatroom> createChatroom(@RequestBody CreateChatroomRequest request) {
        Chatroom room = chatroomService.createChatroom(
                request.name(),
                request.expiryHours(),
                request.userId(),
                request.username()
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(room);
    }

    // POST /chatrooms/{id}/messages
    @PostMapping("/{id}/messages")
    public ResponseEntity<Message> sendMessage(@PathVariable Integer id,
                                               @RequestBody SendMessageRequest request) {
        Message message = chatroomService.sendMessage(
                id,
                request.text(),
                request.userId(),
                request.username()
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(message);
    }

    // GET /chatrooms
    @GetMapping
    public ResponseEntity<Iterable<Chatroom>> getAllChatrooms() {
        return ResponseEntity.ok(chatroomService.getAllChatrooms());
    }

    // GET /chatrooms/{id}
    @GetMapping("/{id}")
    public ResponseEntity<Optional<Chatroom>> getChatroomById(@PathVariable Integer id) {
        return ResponseEntity.ok(chatroomService.getChatroomById(id));
    }

    // GET /chatrooms/{id}/messages
    @GetMapping("/{id}/messages")
    public ResponseEntity<List<MessageResponse>> getAllMessages(@PathVariable Integer id) {
        return ResponseEntity.ok(chatroomService.getAllMessages(id));
    }

    @ExceptionHandler(ChatroomExpiredException.class)
    public ResponseEntity<String> handleExpired(ChatroomExpiredException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(ex.getMessage());
    }
}