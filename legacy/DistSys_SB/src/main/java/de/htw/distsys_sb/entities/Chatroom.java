package de.htw.distsys_sb.entities;

import jakarta.persistence.*;
import org.springframework.cglib.core.Local;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "chatrooms")
public class Chatroom {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "room_id", updatable = false, nullable = false)
    private String roomId;

    @Column(name = "room_name", nullable = false)
    private String roomName;

    @ElementCollection
    @CollectionTable(name = "chatroom_users", joinColumns = @JoinColumn(name = "room_id"))
    @Column(name = "username")
    private List<String> users;

    @Column(name = "created_time", nullable = false, updatable = false)
    private LocalDateTime createdTime;

    @Column(name = "expiration_time", nullable = true, updatable = false)
    private LocalDateTime expirationTime;

    @PrePersist
    protected void onCreate() {
        this.createdTime = LocalDateTime.now();
    }

    public Chatroom() {}

    public Chatroom(String roomName, String user, long expiration) {
        this.roomName = roomName;
        this.users= new ArrayList<String>();
        this.users.add(user);
        this.createdTime = LocalDateTime.now();
        this.expirationTime = LocalDateTime.now().plusHours(expiration);
    }

    public String getRoomId() { return roomId; }
    public void setRoomId(String roomId) { this.roomId = roomId; }

    public String getName() { return roomName; }
    public void setName(String roomName) { this.roomName = roomName; }

    public List<String> getUsers() { return users; }

    public void setUsers(List<String> users) { this.users.addAll(users); }

    public void addUser(String user) {users.add(user);}

    public LocalDateTime getCreatedTime() { return createdTime; }

    public void setExpiration(String hours) { this.expirationTime = createdTime.plusHours(Long.parseLong(hours)); }
}