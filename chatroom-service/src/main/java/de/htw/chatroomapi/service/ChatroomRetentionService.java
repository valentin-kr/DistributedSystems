package de.htw.chatroomapi.service;

import de.htw.chatroomapi.model.Chatroom;
import de.htw.chatroomapi.model.Media;
import de.htw.chatroomapi.repo.ChatroomRepo;
import de.htw.chatroomapi.repo.MediaRepo;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.List;

@Service
public class ChatroomRetentionService {

    private final ChatroomRepo chatroomRepo;
    private final MediaRepo mediaRepo;
    private final Path storageDir;
    private final long retentionDays;

    public ChatroomRetentionService(ChatroomRepo chatroomRepo,
            MediaRepo mediaRepo,
            @Value("${media.storage-dir:./media-storage}") String storageDir,
            @Value("${chatroom.retention-days:7}") long retentionDays) {
        this.chatroomRepo = chatroomRepo;
        this.mediaRepo = mediaRepo;
        this.storageDir = Paths.get(storageDir);
        this.retentionDays = retentionDays;
    }

    @Scheduled(fixedRate = 3_600_000)
    @Transactional
    public int purgeExpiredChatrooms() {
        LocalDateTime cutoff = LocalDateTime.now().minusDays(retentionDays);
        List<Chatroom> toDelete = chatroomRepo.findByExpiryDateBefore(cutoff);

        for (Chatroom room : toDelete) {
            List<Media> mediaItems = mediaRepo.findByChatroomId(room.getId());
            for (Media media : mediaItems) {
                try {
                    Files.deleteIfExists(storageDir.resolve(media.getStoragePath()));
                } catch (IOException e) {
                    // best effort: DB row is still removed below even if file cleanup fails
                }
            }
            mediaRepo.deleteAll(mediaItems);
            chatroomRepo.delete(room);
        }

        return toDelete.size();
    }
}
