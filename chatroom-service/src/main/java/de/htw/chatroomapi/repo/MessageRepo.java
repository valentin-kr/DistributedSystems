package de.htw.chatroomapi.repo;

import de.htw.chatroomapi.model.Message;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.*;

import java.util.List;

@Repository
public interface MessageRepo extends JpaRepository<Message, Integer> {

    List<Message> findByChatroomIdAndSeqIdGreaterThanEqual(
            Integer chatroomId, Long seqId);

    @Query("SELECT COALESCE(MAX(m.seqId), 0) FROM Message m WHERE m.chatroom.id = :chatroomId")
    Long findMaxSeqIdByChatroomId(@Param("chatroomId") Integer chatroomId);

    List<Message> findByChatroomIdOrderBySeqIdAsc(Integer chatroomId);
}
