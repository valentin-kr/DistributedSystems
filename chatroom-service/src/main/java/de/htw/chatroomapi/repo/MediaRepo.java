package de.htw.chatroomapi.repo;

import de.htw.chatroomapi.model.Media;
import org.springframework.data.repository.CrudRepository;

import java.util.List;

public interface MediaRepo extends CrudRepository<Media, Integer> {
    List<Media> findByChatroomId(Integer chatroomId);
}
