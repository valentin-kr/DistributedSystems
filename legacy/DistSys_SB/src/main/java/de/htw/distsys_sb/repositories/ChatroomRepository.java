package de.htw.distsys_sb.repositories;

import org.springframework.data.repository.CrudRepository;
import de.htw.distsys_sb.entities.Chatroom;

public interface ChatroomRepository extends CrudRepository<Chatroom, Integer> {


    static Chatroom findChatroomById(Integer id) {
        return null;
    }

}
