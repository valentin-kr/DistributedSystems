package de.htw.chatroomapi.service;

import de.htw.chatroomapi.dto.MessageResponse;
import de.htw.chatroomapi.model.Chatroom;
import de.htw.chatroomapi.model.Message;
import de.htw.chatroomapi.repo.ChatroomRepo;
import de.htw.chatroomapi.repo.MessageRepo;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class ChatroomService {

    private final ChatroomRepo chatroomRepository;
    private final MessageRepo messageRepository;

    public ChatroomService(ChatroomRepo chatroomRepository, MessageRepo messageRepository) {
        this.chatroomRepository = chatroomRepository;
        this.messageRepository = messageRepository;
    }

    @Transactional
    public Chatroom createChatroom(String name, String description, long expiryHours, long userId) {
        Chatroom room = new Chatroom();
        LocalDateTime now = LocalDateTime.now();
        room.setName(name);
        room.setDescription(description);
        room.setCreatedAt(now);
        room.setExpiryDate(now.plusHours(expiryHours));
        room.addMember(userId);
        return chatroomRepository.save(room);
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
            throw new ChatroomExpiredException(chatroomId);
        }
        if (!room.hasMember(userId)) {
            throw new NotChatroomMemberException(userId, chatroomId);
        }

        Message message = new Message();
        message.setText(text);
        message.setAuthorId(userId);
        message.setTimestamp(LocalDateTime.now());
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
                message.getSeqId(),
                message.getText(),
                message.getAuthorId(),
                message.getTimestamp()
        );
    }

    private Chatroom findRoom(Integer id) {
        return chatroomRepository.findById(id)
                .orElseThrow(() -> new ChatroomNotFoundException(id));
    }
}
