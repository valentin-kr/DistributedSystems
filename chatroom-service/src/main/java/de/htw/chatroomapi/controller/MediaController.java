package de.htw.chatroomapi.controller;

import de.htw.chatroomapi.dto.MediaResponse;
import de.htw.chatroomapi.model.Media;
import de.htw.chatroomapi.service.MediaService;
import de.htw.chatroomapi.service.RoomEventService;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/chatrooms/{chatroomId}/media")
public class MediaController {

    private final MediaService mediaService;
    private final RoomEventService roomEventService;

    public MediaController(MediaService mediaService, RoomEventService roomEventService) {
        this.mediaService = mediaService;
        this.roomEventService = roomEventService;
    }

    // POST /chatrooms/{chatroomId}/media
    @PostMapping
    public ResponseEntity<MediaResponse> upload(@PathVariable Integer chatroomId,
                                                 @RequestParam("file") MultipartFile file,
                                                 @RequestParam Long userId,
                                                 @RequestParam String username) {
        MediaResponse response = mediaService.upload(chatroomId, file, userId, username);
        roomEventService.emitThreadChanged(chatroomId);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    // GET /chatrooms/{chatroomId}/media
    @GetMapping
    public ResponseEntity<List<MediaResponse>> list(@PathVariable Integer chatroomId) {
        return ResponseEntity.ok(mediaService.listMedia(chatroomId));
    }

    // GET /chatrooms/{chatroomId}/media/{mediaId}
    @GetMapping("/{mediaId}")
    public ResponseEntity<Resource> download(@PathVariable Integer chatroomId, @PathVariable Integer mediaId) {
        Media media = mediaService.getMediaOrThrow(chatroomId, mediaId);
        Resource resource = mediaService.loadFile(media);

        String contentType = media.getContentType() != null ? media.getContentType() : "application/octet-stream";

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(contentType))
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + media.getFilename() + "\"")
                .body(resource);
    }
}
