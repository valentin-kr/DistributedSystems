package de.htw.chatroomapi.repo;

import de.htw.chatroomapi.model.Chatroom;
import org.springframework.data.repository.CrudRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface ChatroomRepo extends CrudRepository<Chatroom, Integer> {

    Chatroom findChatroomById(Integer id);

    List<Chatroom> findByExpiryDateBefore(LocalDateTime cutoff);

    Optional<Chatroom> findByJoinCode(String joinCode);
}