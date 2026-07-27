package de.htw.chatroomapi.model;

import jakarta.persistence.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
public class Chatroom {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private Integer id;

    private Long seqId = 0L;

    private String name;

    private LocalDateTime createdAt;
    private LocalDateTime expiryDate;

    @OneToMany(
            mappedBy = "chatroom",
            cascade = CascadeType.ALL,
            fetch = FetchType.LAZY
    )
    private List<Message> messages = new ArrayList<>();

    @ElementCollection
    @CollectionTable(
            name = "chatroom_user_ids",
            joinColumns = @JoinColumn(name = "chatroom_id")
    )
    @Column(name = "user_id")
    private List<Long> userIDList = new ArrayList<>();

    public Integer getId() {
        return id;
    }


    public void setId(Integer id) {
        this.id = id;
    }

    public String name() {
        return name;
    }

    public String getName() {
        return name;
    }

    public long getSeqId(){
        return seqId==null? 0 : seqId;
    }

    public void setCreatedAt(LocalDateTime createdAt){
        this.createdAt = createdAt;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setExpiryDate(LocalDateTime expiryDate) {
        this.expiryDate = expiryDate;
    }

    public LocalDateTime getExpiryDate() {
        return expiryDate;
    }

    public boolean isExpired() {
        return expiryDate != null && LocalDateTime.now().isAfter(expiryDate);
    }



    public void setName(String name) {
        this.name = name;
    }

    public  List<Long> getUserIDList(){
        return userIDList;
    }

    public void setSeqId(Long seqId) {
        this.seqId = seqId;
    }
}
