package de.htw.chatroomapi;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.web.bind.annotation.*;

@SpringBootApplication
@RestController

public class ChatroomApiApplication {

    public static void main(String[] args) {
        SpringApplication.run(ChatroomApiApplication.class, args);
    }
}
