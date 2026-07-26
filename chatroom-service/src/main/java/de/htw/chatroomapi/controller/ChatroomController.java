package de.htw.chatroomapi.controller;

import de.htw.chatroomapi.dto.AddMemberRequest;
import de.htw.chatroomapi.dto.ChatroomResponse;
import de.htw.chatroomapi.dto.CreateChatroomRequest;
import de.htw.chatroomapi.dto.MessageResponse;
import de.htw.chatroomapi.dto.RenameChatroomRequest;
import de.htw.chatroomapi.dto.SendMessageRequest;
import de.htw.chatroomapi.model.Chatroom;
import de.htw.chatroomapi.model.Message;
import de.htw.chatroomapi.service.ChatroomService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.stream.StreamSupport;

@RestController
@RequestMapping("/chatrooms")
public class ChatroomController {

    private final ChatroomService chatroomService;

    public ChatroomController(ChatroomService chatroomService) {
        this.chatroomService = chatroomService;
    }

    @PostMapping
    public ResponseEntity<ChatroomResponse> createChatroom(@RequestBody CreateChatroomRequest request) {
        Chatroom room = chatroomService.createChatroom(
                request.name(),
                request.description(),
                request.expiryHours(),
                request.userId());
        return ResponseEntity.status(HttpStatus.CREATED).body(toChatroomResponse(room));
    }

    @PostMapping("/{id}/messages")
    public ResponseEntity<MessageResponse> sendMessage(@PathVariable Integer id,
            @RequestBody SendMessageRequest request) {
        Message message = chatroomService.sendMessage(
                id,
                request.text(),
                request.userId());
        return ResponseEntity.status(HttpStatus.CREATED).body(chatroomService.toMessageResponse(message));
    }

    @PostMapping("/{id}/members")
    public ResponseEntity<ChatroomResponse> addMember(@PathVariable Integer id,
            @RequestBody AddMemberRequest request) {
        return ResponseEntity.ok(toChatroomResponse(chatroomService.addMember(id, request.userId())));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<ChatroomResponse> renameChatroom(@PathVariable Integer id,
            @RequestBody RenameChatroomRequest request) {
        return ResponseEntity
                .ok(toChatroomResponse(chatroomService.updateChatroom(id, request.name(), request.description())));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteChatroom(@PathVariable Integer id) {
        chatroomService.deleteChatroom(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping
    public ResponseEntity<List<ChatroomResponse>> getAllChatrooms() {
        List<ChatroomResponse> rooms = StreamSupport.stream(chatroomService.getAllChatrooms().spliterator(), false)
                .map(this::toChatroomResponse)
                .toList();
        return ResponseEntity.ok(rooms);
    }

    @GetMapping("/{id}")
    public ResponseEntity<ChatroomResponse> getChatroomById(@PathVariable Integer id) {
        return ResponseEntity.ok(toChatroomResponse(chatroomService.getChatroomById(id)));
    }

    @GetMapping("/{id}/messages")
    public ResponseEntity<List<MessageResponse>> getAllMessages(@PathVariable Integer id) {
        return ResponseEntity.ok(chatroomService.getAllMessages(id));
    }

    @GetMapping("/{id}/members")
    public ResponseEntity<List<Long>> getMembers(@PathVariable Integer id) {
        return ResponseEntity.ok(chatroomService.getMembers(id));
    }

    private ChatroomResponse toChatroomResponse(Chatroom room) {
        return new ChatroomResponse(
                room.getId(),
                room.getName(),
                room.getDescription(),
                room.getSeqId(),
                room.getCreatedAt(),
                room.getExpiryDate(),
                chatroomService.isActive(room),
                List.copyOf(room.getUserIDList()));
    }
}
