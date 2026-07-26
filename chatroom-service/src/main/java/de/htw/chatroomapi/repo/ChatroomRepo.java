package de.htw.chatroomapi.repo;

import de.htw.chatroomapi.model.Chatroom;
import org.springframework.data.repository.CrudRepository;

public interface ChatroomRepo extends CrudRepository<Chatroom, Integer> {

    Chatroom findChatroomById(Integer id);
}