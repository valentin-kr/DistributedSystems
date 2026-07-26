package de.htw.chatroomapi.service;

import de.htw.chatroomapi.dto.MessageResponse;
import de.htw.chatroomapi.model.Chatroom;
import de.htw.chatroomapi.model.Message;
import de.htw.chatroomapi.repo.ChatroomRepo;
import de.htw.chatroomapi.repo.MessageRepo;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class ChatroomService {

    private final ChatroomRepo chatroomRepository;
    private final MessageRepo messageRepository;

    public ChatroomService(ChatroomRepo chatroomRepository,
        MessageRepo messageRepository) {
        this.chatroomRepository = chatroomRepository;
        this.messageRepository = messageRepository;
    }

    public Chatroom createChatroom(String name, long expiryHours, long userId, String username) {
        System.out.println("creating chat now:"+ name);
        Chatroom room = new Chatroom();
        room.setName(name);
        room.setCreatedAt(LocalDateTime.now());
        room.setExpiryDate(LocalDateTime.now().plusHours(expiryHours));
        room.getUserIDList().add(userId);
        return chatroomRepository.save(room);
    }



    public Message sendMessage(Integer chatroomId, String text, Long userId, String author) {
        Chatroom room = chatroomRepository.findById(chatroomId)
                .orElseThrow(() -> new RuntimeException("Chatroom not found"));

        Message message = new Message();
        message.setText(text);
        message.setAuthor(author, userId);
        message.setTimestamp(LocalDateTime.now());
        message.setChatroom(room);
        // SeqId aus aktueller Nachrichtenanzahl + 1 ableiten
        long newseq = room.getSeqId()+1;
        System.out.println("SEQid" + newseq);
        message.setSeqId(newseq);
        room.setSeqId(newseq);
        return messageRepository.save(message);
    }

    public List<Message> getMessagesSince(Integer chatroomId, Long seqId) {
        return messageRepository
                .findByChatroomIdAndSeqIdGreaterThanEqual(chatroomId, seqId);
    }

    public List<MessageResponse> getAllMessages(Integer chatroomId) {
        chatroomRepository.findById(chatroomId)
                .orElseThrow(() -> new RuntimeException("Chatroom not found"));

        return messageRepository.findByChatroomId(chatroomId)
                .stream()
                .map(message -> new MessageResponse(
                        message.getSeqId(),
                        message.getText(),
                        message.getAuthorName(),
                        message.getAuthorId(),
                        message.getTimestamp()
                ))
                .toList();
    }

     public Iterable<Chatroom> getAllChatrooms() {
        return chatroomRepository.findAll();
    }

    public Optional<Chatroom> getChatroomById(Integer id) {
        return chatroomRepository.findById(id);
    }
}
