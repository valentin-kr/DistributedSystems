package de.htw.chatroomapi.service;

import org.springframework.stereotype.Service;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;

@Service
public class RoomEventService {

    private static final long SSE_TIMEOUT_MS = 3_600_000L;
    private final ConcurrentHashMap<Integer, Set<SseEmitter>> roomEmitters = new ConcurrentHashMap<>();

    public SseEmitter subscribe(Integer chatroomId) {
        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT_MS);
        roomEmitters.computeIfAbsent(chatroomId, ignored -> new CopyOnWriteArraySet<>()).add(emitter);

        emitter.onCompletion(() -> removeEmitter(chatroomId, emitter));
        emitter.onTimeout(() -> removeEmitter(chatroomId, emitter));
        emitter.onError(ignored -> removeEmitter(chatroomId, emitter));

        sendToEmitter(chatroomId, emitter, "connected");
        return emitter;
    }

    @Scheduled(fixedRate = 25_000L)
    public void sendHeartbeats() {
        for (Integer chatroomId : roomEmitters.keySet()) {
            emitToRoom(chatroomId, "heartbeat");
        }
    }

    public void emitThreadChanged(Integer chatroomId) {
        emitToRoom(chatroomId, "thread-changed");
    }

    private void emitToRoom(Integer chatroomId, String event) {
        Set<SseEmitter> emitters = roomEmitters.get(chatroomId);
        if (emitters == null) {
            return;
        }

        for (SseEmitter emitter : emitters) {
            sendToEmitter(chatroomId, emitter, event);
        }
    }

    private void sendToEmitter(Integer chatroomId, SseEmitter emitter, String event) {
        try {
            emitter.send(event);
        } catch (IOException | IllegalStateException ex) {
            removeEmitter(chatroomId, emitter);
            emitter.complete();
        }
    }

    private void removeEmitter(Integer chatroomId, SseEmitter emitter) {
        Set<SseEmitter> emitters = roomEmitters.get(chatroomId);
        if (emitters == null) {
            return;
        }

        emitters.remove(emitter);
        if (emitters.isEmpty()) {
            roomEmitters.remove(chatroomId, emitters);
        }
    }
}
