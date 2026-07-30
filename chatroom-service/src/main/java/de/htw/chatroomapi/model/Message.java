package de.htw.chatroomapi.model;

import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
public class Message {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private Integer id;

    private Long seqId;
    private String text;
    private LocalDateTime timestamp;

    private Long authorId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "chatroom_id")
    private Chatroom chatroom;

    public void setText(String text) {
        this.text = text;
    }

    public void setAuthorId(Long userId) {
        this.authorId = userId;
    }

    public void setTimestamp(LocalDateTime time) {
        this.timestamp = time;
    }

    public void setChatroom(Chatroom room) {
        this.chatroom = room;
    }

    public void setSeqId(long seqId) {
        this.seqId = seqId;
    }

    public Integer getId() {
        return id;
    }

    public Chatroom getChatroom() {
        return chatroom;
    }

    public Long getSeqId() {
        return seqId;
    }

    public String getText() {
        return text;
    }

    public Long getAuthorId() {
        return authorId;
    }

    public LocalDateTime getTimestamp() {
        return timestamp;
    }

}
