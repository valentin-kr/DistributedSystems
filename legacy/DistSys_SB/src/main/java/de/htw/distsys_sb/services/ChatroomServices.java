package de.htw.distsys_sb.services;

import java.util.List;
import java.time.LocalDateTime;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;
import java.io.InputStream;
import java.util.List;

@Service
public class ChatroomServices {

    private final ObjectMapper objectMapper = new ObjectMapper();

    public void createChatroom(int hours, String name){

    }

    public void createTestrooms(){

    }
}