package de.htw.chatroomapi.service;

import de.htw.chatroomapi.dto.MessageResponse;
import de.htw.chatroomapi.model.Chatroom;
import de.htw.chatroomapi.model.Message;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@ActiveProfiles("test")
class ChatroomServiceTests {

    @Autowired
    private ChatroomService chatroomService;

    @Test
    void createRoomAddsCreatorAsFirstMember() {
        Chatroom room = chatroomService.createChatroom("demo", "optional description", 2, 42L);

        assertThat(room.getId()).isNotNull();
        assertThat(room.getName()).isEqualTo("demo");
        assertThat(room.getDescription()).isEqualTo("optional description");
        assertThat(room.getUserIDList()).containsExactly(42L);
        assertThat(chatroomService.isActive(room)).isTrue();
    }

    @Test
    void addMemberAllowsNewMemberToSendMessage() {
        Chatroom room = chatroomService.createChatroom("demo", null, 2, 42L);

        chatroomService.addMember(room.getId(), 7L);
        Message message = chatroomService.sendMessage(room.getId(), "hello", 7L);

        assertThat(message.getAuthorId()).isEqualTo(7L);
        assertThat(chatroomService.getChatroomById(room.getId()).getUserIDList()).containsExactly(42L, 7L);
    }

    @Test
    void getMembersReturnsChatroomUserIds() {
        Chatroom room = chatroomService.createChatroom("demo", null, 2, 42L);
        chatroomService.addMember(room.getId(), 7L);

        assertThat(chatroomService.getMembers(room.getId())).containsExactly(42L, 7L);
    }

    @Test
    void messageSequenceIncrementsInOrder() {
        Chatroom room = chatroomService.createChatroom("demo", null, 2, 42L);

        chatroomService.sendMessage(room.getId(), "one", 42L);
        chatroomService.sendMessage(room.getId(), "two", 42L);

        List<MessageResponse> messages = chatroomService.getAllMessages(room.getId());
        assertThat(messages).extracting(MessageResponse::seqId).containsExactly(1L, 2L);
        assertThat(chatroomService.getChatroomById(room.getId()).getSeqId()).isEqualTo(2L);
    }

    @Test
    void expiredRoomBlocksNewMessagesButRemainsReadable() {
        Chatroom room = chatroomService.createChatroom("expired", null, -1, 42L);

        assertThatThrownBy(() -> chatroomService.sendMessage(room.getId(), "late", 42L))
                .isInstanceOf(ChatroomExpiredException.class);
        assertThat(chatroomService.getAllMessages(room.getId())).isEmpty();
        assertThat(chatroomService.getChatroomById(room.getId()).getId()).isEqualTo(room.getId());
    }

    @Test
    void nonMemberCannotSendMessage() {
        Chatroom room = chatroomService.createChatroom("demo", null, 2, 42L);

        assertThatThrownBy(() -> chatroomService.sendMessage(room.getId(), "nope", 99L))
                .isInstanceOf(NotChatroomMemberException.class);
    }

    @Test
    void memberCanRecordActivityWithoutSendingMessage() {
        Chatroom room = chatroomService.createChatroom("demo", null, 2, 42L);

        chatroomService.recordActivity(room.getId(), 42L);
    }

    @Test
    void nonMemberCannotRecordActivity() {
        Chatroom room = chatroomService.createChatroom("demo", null, 2, 42L);

        assertThatThrownBy(() -> chatroomService.recordActivity(room.getId(), 99L))
                .isInstanceOf(NotChatroomMemberException.class);
    }

    @Test
    void renameChatroomUpdatesName() {
        Chatroom room = chatroomService.createChatroom("demo", "before", 2, 42L);

        Chatroom renamed = chatroomService.updateChatroom(room.getId(), "new demo", "after");

        assertThat(renamed.getName()).isEqualTo("new demo");
        assertThat(renamed.getDescription()).isEqualTo("after");
        assertThat(chatroomService.getChatroomById(room.getId()).getName()).isEqualTo("new demo");
        assertThat(chatroomService.getChatroomById(room.getId()).getDescription()).isEqualTo("after");
    }

    @Test
    void deleteChatroomRemovesRoom() {
        Chatroom room = chatroomService.createChatroom("demo", null, 2, 42L);
        chatroomService.sendMessage(room.getId(), "hello", 42L);

        chatroomService.deleteChatroom(room.getId());

        assertThatThrownBy(() -> chatroomService.getChatroomById(room.getId()))
                .isInstanceOf(ChatroomNotFoundException.class);
    }
}
