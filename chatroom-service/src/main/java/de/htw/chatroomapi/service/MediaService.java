package de.htw.chatroomapi.service;

import de.htw.chatroomapi.dto.MediaResponse;
import de.htw.chatroomapi.model.Chatroom;
import de.htw.chatroomapi.model.Media;
import de.htw.chatroomapi.repo.ChatroomRepo;
import de.htw.chatroomapi.repo.MediaRepo;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class MediaService {

    private final MediaRepo mediaRepo;
    private final ChatroomRepo chatroomRepo;
    private final Path storageDir;

    public MediaService(MediaRepo mediaRepo,
                         ChatroomRepo chatroomRepo,
                         @Value("${media.storage-dir:./media-storage}") String storageDir) throws IOException {
        this.mediaRepo = mediaRepo;
        this.chatroomRepo = chatroomRepo;
        this.storageDir = Paths.get(storageDir);
        Files.createDirectories(this.storageDir);
    }

    public MediaResponse upload(Integer chatroomId, MultipartFile file, Long userId, String username) {
        Chatroom room = chatroomRepo.findById(chatroomId)
                .orElseThrow(() -> new ChatroomNotFoundException(chatroomId));

        if (room.isExpired()) {
            throw new ChatroomExpiredException(room.getName());
        }

        String storedName = UUID.randomUUID() + "-" + file.getOriginalFilename();
        try {
            Files.copy(file.getInputStream(), storageDir.resolve(storedName));
        } catch (IOException e) {
            throw new RuntimeException("Failed to store file", e);
        }

        Media media = new Media();
        media.setFilename(file.getOriginalFilename());
        media.setContentType(file.getContentType());
        media.setStoragePath(storedName);
        media.setUploaderId(userId);
        media.setUploaderName(username);
        media.setUploadedAt(Instant.now());
        media.setChatroom(room);

        return toResponse(mediaRepo.save(media));
    }

    public List<MediaResponse> listMedia(Integer chatroomId) {
        chatroomRepo.findById(chatroomId)
                .orElseThrow(() -> new ChatroomNotFoundException(chatroomId));

        return mediaRepo.findByChatroomId(chatroomId).stream()
                .map(this::toResponse)
                .toList();
    }

    public Media getMediaOrThrow(Integer chatroomId, Integer mediaId) {
        Media media = mediaRepo.findById(mediaId)
                .orElseThrow(() -> new RuntimeException("Media not found"));

        if (!media.getChatroom().getId().equals(chatroomId)) {
            throw new RuntimeException("Media not found");
        }
        return media;
    }

    public Resource loadFile(Media media) {
        try {
            return new UrlResource(storageDir.resolve(media.getStoragePath()).toUri());
        } catch (MalformedURLException e) {
            throw new RuntimeException("Could not load file", e);
        }
    }

    private MediaResponse toResponse(Media media) {
        return new MediaResponse(
                media.getId(),
                media.getFilename(),
                media.getContentType(),
                media.getUploaderId(),
                media.getUploaderName(),
                media.getUploadedAt()
        );
    }
}
