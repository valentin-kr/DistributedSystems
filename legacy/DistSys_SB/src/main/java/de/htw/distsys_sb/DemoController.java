package de.htw.distsys_sb;

import de.htw.distsys_sb.entities.Chatroom;
import de.htw.distsys_sb.repositories.ChatroomRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

@RestController
public class DemoController {

    @Autowired
    private ChatroomRepository chatroomRepository;

    @PostMapping("/add")
    public String addChatroom(@RequestParam String first, @RequestParam String last, @RequestParam long expire) {
        Chatroom chatroom = new Chatroom(first, last, expire);

        chatroomRepository.save(chatroom);
        return "Added new customer to repo!";
    }

    @GetMapping("/hellolo")
    public String sayHello(@RequestParam(value = "myName", defaultValue = "World") String name) {
        return String.format("Hello you lovely %s!", name);
    }

    @GetMapping("/list")
    public Iterable<Chatroom> getChatroom() {
        return chatroomRepository.findAll();
    }

    @GetMapping("/find/{id}")
    public Chatroom findChatroomById(@PathVariable Integer id) {
        return ChatroomRepository.findChatroomById(id);
    }
}
