package de.htw.chatroomapi.service;

import de.htw.chatroomapi.dto.MessageResponse;
import de.htw.chatroomapi.model.Chatroom;
import de.htw.chatroomapi.model.Message;
import de.htw.chatroomapi.repo.ChatroomRepo;
import de.htw.chatroomapi.repo.MessageRepo;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Random;

@Service
public class ChatroomService {

    private final ChatroomRepo chatroomRepository;
    private final MessageRepo messageRepository;

    public ChatroomService(ChatroomRepo chatroomRepository, MessageRepo messageRepository) {
        this.chatroomRepository = chatroomRepository;
        this.messageRepository = messageRepository;
    }

    private static final String JOIN_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    @Transactional
    public Chatroom createChatroom(String name, String description, long expiryHours, long userId) {
        Chatroom room = new Chatroom();
        LocalDateTime now = LocalDateTime.now();
        room.setName(name);
        room.setDescription(description);
        room.setCreatedAt(now);
        room.setExpiryDate(now.plusHours(expiryHours));
        room.setCreatorId(userId);
        room.setJoinCode(generateUniqueJoinCode());
        room.addMember(userId);
        return chatroomRepository.save(room);
    }

    @Transactional
    public Chatroom joinByCode(String code, Long userId) {
        Chatroom room = chatroomRepository.findByJoinCode(code)
                .orElseThrow(() -> new InvalidJoinCodeException(code));
        if (!isActive(room)) {
            throw new ChatroomExpiredException(room.getName());
        }
        room.addMember(userId);
        return chatroomRepository.save(room);
    }

    private String generateUniqueJoinCode() {
        Random random = new Random();
        for (int attempt = 0; attempt < 10; attempt++) {
            StringBuilder code = new StringBuilder();
            for (int i = 0; i < 6; i++) {
                code.append(JOIN_CODE_CHARS.charAt(random.nextInt(JOIN_CODE_CHARS.length())));
            }
            if (chatroomRepository.findByJoinCode(code.toString()).isEmpty()) {
                return code.toString();
            }
        }
        throw new IllegalStateException("Could not generate a unique join code");
    }

    @Transactional
    public void removeMember(Integer chatroomId, Long targetUserId, Long requesterId) {
        Chatroom room = findRoom(chatroomId);
        requireOwner(room, requesterId, chatroomId);
        room.removeMember(targetUserId);
        chatroomRepository.save(room);
    }

    @Transactional
    public void deleteMessage(Integer chatroomId, Integer messageId, Long requesterId) {
        Chatroom room = findRoom(chatroomId);
        requireOwner(room, requesterId, chatroomId);

        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> new ChatroomNotFoundException(chatroomId));
        if (!message.getChatroom().getId().equals(chatroomId)) {
            throw new ChatroomNotFoundException(chatroomId);
        }
        messageRepository.delete(message);
    }

    private void requireOwner(Chatroom room, Long requesterId, Integer chatroomId) {
        if (!room.getCreatorId().equals(requesterId)) {
            throw new NotChatroomOwnerException(requesterId, chatroomId);
        }
    }

    @Transactional
    public Chatroom addMember(Integer chatroomId, Long userId) {
        Chatroom room = findRoom(chatroomId);
        room.addMember(userId);
        return chatroomRepository.save(room);
    }

    @Transactional
    public Chatroom renameChatroom(Integer chatroomId, String name) {
        return updateChatroom(chatroomId, name, null);
    }

    @Transactional
    public Chatroom updateChatroom(Integer chatroomId, String name, String description) {
        Chatroom room = findRoom(chatroomId);
        if (name != null) {
            room.setName(name);
        }
        if (description != null) {
            room.setDescription(description);
        }
        return chatroomRepository.save(room);
    }

    @Transactional
    public void deleteChatroom(Integer chatroomId) {
        Chatroom room = findRoom(chatroomId);
        chatroomRepository.delete(room);
    }

    @Transactional
    public Message sendMessage(Integer chatroomId, String text, Long userId) {
        Chatroom room = findRoom(chatroomId);
        if (!isActive(room)) {
            throw new ChatroomExpiredException(room.getName());
        }
        if (!room.hasMember(userId)) {
            throw new NotChatroomMemberException(userId, chatroomId);
        }

        Message message = new Message();
        message.setText(text);
        message.setAuthorId(userId);
        message.setTimestamp(Instant.now());
        message.setChatroom(room);

        long nextSeqId = messageRepository.findMaxSeqIdByChatroomId(chatroomId) + 1;
        message.setSeqId(nextSeqId);
        room.setSeqId(nextSeqId);
        return messageRepository.save(message);
    }

    public List<Message> getMessagesSince(Integer chatroomId, Long seqId) {
        findRoom(chatroomId);
        return messageRepository.findByChatroomIdAndSeqIdGreaterThanEqual(chatroomId, seqId);
    }

    public List<MessageResponse> getAllMessages(Integer chatroomId) {
        findRoom(chatroomId);
        return messageRepository.findByChatroomIdOrderBySeqIdAsc(chatroomId)
                .stream()
                .map(this::toMessageResponse)
                .toList();
    }

    public List<Long> getMembers(Integer chatroomId) {
        Chatroom room = findRoom(chatroomId);
        return List.copyOf(room.getUserIDList());
    }

    public Iterable<Chatroom> getAllChatrooms() {
        return chatroomRepository.findAll();
    }

    public Chatroom getChatroomById(Integer id) {
        return findRoom(id);
    }

    public boolean isActive(Chatroom room) {
        return LocalDateTime.now().isBefore(room.getExpiryDate());
    }

    public MessageResponse toMessageResponse(Message message) {
        return new MessageResponse(
                message.getId(),
                message.getSeqId(),
                message.getText(),
                message.getAuthorId(),
                message.getTimestamp());
    }

    private Chatroom findRoom(Integer id) {
        return chatroomRepository.findById(id)
                .orElseThrow(() -> new ChatroomNotFoundException(id));
    }
}
