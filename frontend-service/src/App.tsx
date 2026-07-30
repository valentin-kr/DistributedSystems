import { useEffect, useRef, useState } from "react";
import type { SyntheticEvent } from "react";
import {
  ArrowRight,
  LogIn,
  LogOut,
  MessageCircle,
  Plus,
} from "lucide-react";
import { apiUrl } from "./api/client";
import { AuthFlow } from "./components/AuthFlow";
import { CreateRoom } from "./components/CreateRoom";
import { JoinRoom } from "./components/JoinRoom";
import { RoomList } from "./components/RoomList";
import { RoomScreen } from "./components/RoomScreen";
import { useAuthFlow } from "./hooks/useAuthFlow";
import { useChatrooms } from "./hooks/useChatrooms";
import { useMessageContextMenu } from "./hooks/useMessageContextMenu";
import { useRoomComposer } from "./hooks/useRoomComposer";
import type { FlowIntent, Screen } from "./types";

type FormSubmitEvent = SyntheticEvent<HTMLFormElement>;

export default function App() {
  const [screen, setScreen] = useState<Screen>("choice");
  const [intent, setIntent] = useState<FlowIntent>(null);
  const clearMessageErrorRef = useRef<(() => void) | null>(null);

  const auth = useAuthFlow({
    intent,
    onAuthenticated: async (nextIntent) => {
      if (nextIntent === "create") {
        setScreen("create-room");
      } else if (nextIntent === "join") {
        setScreen("join-room");
      } else {
        await showRoomListScreen();
      }
    },
    onLogout: () => {
      chatrooms.resetRooms();
      setIntent(null);
      goToChoice();
    },
  });

  const chatrooms = useChatrooms({
    currentUser: auth.currentUser,
    onRoomLoaded: () => clearMessageErrorRef.current?.(),
  });

  const composer = useRoomComposer({
    currentRoomId: chatrooms.currentRoomId,
    currentUser: auth.currentUser,
    usernameFor: chatrooms.usernameFor,
    reloadThread: chatrooms.reloadThread,
  });
  clearMessageErrorRef.current = composer.clearMessageError;

  const contextMenu = useMessageContextMenu({
    onDeleteMessage: composer.deleteMessage,
  });

  useEffect(() => {
    if (auth.currentUser) {
      void showRoomListScreen();
    }
  }, []);

  useEffect(() => {
    if (screen !== "room" || !chatrooms.currentRoomId) {
      return;
    }

    let closed = false;
    const source = new EventSource(
      apiUrl(`/chatrooms/${chatrooms.currentRoomId}/events`),
    );

    source.onmessage = (event) => {
      if (!closed && event.data === "thread-changed") {
        void chatrooms.reloadThread();
      }
    };

    source.onerror = () => {
      if (closed) {
        return;
      }
    };

    return () => {
      closed = true;
      source.close();
    };
  }, [screen, chatrooms.currentRoomId, chatrooms.reloadThread]);

  function goToChoice() {
    setIntent(null);
    setScreen("choice");
  }

  async function goBackFromFlow() {
    if (auth.currentUser) {
      await showRoomListScreen();
    } else {
      goToChoice();
    }
  }

  function startCreateFlow() {
    setIntent("create");
    setScreen(auth.currentUser ? "create-room" : "auth");
  }

  function startJoinFlow() {
    setIntent("join");
    setScreen(auth.currentUser ? "join-room" : "auth");
  }

  async function showRoomListScreen() {
    await chatrooms.showRoomListScreen();
    setScreen("room-list");
  }

  async function enterRoom(roomId: number) {
    await chatrooms.enterRoom(roomId);
    setScreen("room");
  }

  async function createRoom(event: FormSubmitEvent) {
    if (await chatrooms.createRoom(event)) {
      setScreen("room");
    }
  }

  async function joinRoom(event: FormSubmitEvent) {
    if (await chatrooms.joinRoom(event)) {
      setScreen("room");
    }
  }

  return (
    <>
      <header className="app-header">
        <div className="app-header-inner">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              <MessageCircle size={21} strokeWidth={2.4} />
            </span>
            <div className="brand-copy">
              <h1>TimeChat</h1>
              <span>Chats that stay in the moment</span>
            </div>
          </div>
          <div id="logged-in-view" hidden={!auth.currentUser}>
            <span className="user-avatar" aria-hidden="true">
              {auth.currentUser?.username.charAt(0).toUpperCase()}
            </span>
            <span id="logged-in-as">
              <small>Signed in as</small>
              <strong>{auth.currentUser?.username}</strong>
            </span>
            <button
              id="logout-btn"
              className="header-action"
              type="button"
              onClick={auth.logout}
              aria-label="Log out"
              title="Log out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <main>
        <section
          id="screen-choice"
          className="screen"
          hidden={screen !== "choice"}
        >
          <div className="intro-copy">
            <span className="eyebrow">Private. Temporary. Together.</span>
            <h2>Make space for the conversation</h2>
            <p>
              Start a room for your group or enter one with a six-character
              invite code.
            </p>
          </div>
          <div className="choice-grid">
            <button
              id="choice-create-btn"
              className="big-choice primary-choice"
              type="button"
              onClick={startCreateFlow}
            >
              <span className="choice-icon" aria-hidden="true">
                <Plus size={24} />
              </span>
              <span className="choice-copy">
                <strong>Create a chatroom</strong>
                <small>Set a name and expiry time</small>
              </span>
              <ArrowRight className="choice-arrow" size={20} aria-hidden="true" />
            </button>
            <button
              id="choice-join-btn"
              className="big-choice secondary-choice"
              type="button"
              onClick={startJoinFlow}
            >
              <span className="choice-icon" aria-hidden="true">
                <LogIn size={23} />
              </span>
              <span className="choice-copy">
                <strong>Join a chatroom</strong>
                <small>Use an invite code</small>
              </span>
              <ArrowRight className="choice-arrow" size={20} aria-hidden="true" />
            </button>
          </div>
        </section>

        <AuthFlow
          hidden={screen !== "auth"}
          phoneNumber={auth.phoneNumber}
          verifyCode={auth.verifyCode}
          signupUsername={auth.signupUsername}
          smsNote={auth.smsNote}
          authError={auth.authError}
          showVerifyForm={auth.showVerifyForm}
          onBack={() => void goBackFromFlow()}
          onRequestCode={auth.requestCode}
          onVerifyPhone={auth.verifyPhone}
          onPhoneNumberChange={auth.setPhoneNumber}
          onVerifyCodeChange={auth.setVerifyCode}
          onSignupUsernameChange={auth.setSignupUsername}
        />

        <CreateRoom
          hidden={screen !== "create-room"}
          roomName={chatrooms.roomName}
          roomDescription={chatrooms.roomDescription}
          durationDays={chatrooms.durationDays}
          durationHours={chatrooms.durationHours}
          durationPreview={chatrooms.durationPreview}
          createRoomError={chatrooms.createRoomError}
          onBack={() => void goBackFromFlow()}
          onSubmit={createRoom}
          onRoomNameChange={chatrooms.setRoomName}
          onRoomDescriptionChange={chatrooms.setRoomDescription}
          onDurationDaysChange={chatrooms.setDurationDays}
          onDurationHoursChange={chatrooms.setDurationHours}
        />

        <JoinRoom
          hidden={screen !== "join-room"}
          joinCode={chatrooms.joinCode}
          joinError={chatrooms.joinError}
          onBack={() => void goBackFromFlow()}
          onSubmit={joinRoom}
          onJoinCodeChange={chatrooms.setJoinCode}
        />

        <RoomList
          hidden={screen !== "room-list"}
          rooms={chatrooms.myRooms}
          onCreate={startCreateFlow}
          onJoin={startJoinFlow}
          onEnterRoom={(roomId) => void enterRoom(roomId)}
        />

        <RoomScreen
          hidden={screen !== "room"}
          room={chatrooms.currentRoom}
          users={chatrooms.users}
          currentUser={auth.currentUser}
          currentRoomId={chatrooms.currentRoomId}
          threadItems={chatrooms.threadItems}
          showInfo={chatrooms.showInfo}
          isCreator={chatrooms.isCreator}
          messageText={composer.messageText}
          messageError={composer.messageError}
          mediaError={composer.mediaError}
          recordStatus={composer.recordStatus}
          isRecording={composer.isRecording}
          fileInputRef={composer.fileInputRef}
          threadRef={chatrooms.threadRef}
          usernameFor={chatrooms.usernameFor}
          onBack={() => void showRoomListScreen()}
          onToggleInfo={() => chatrooms.setShowInfo((value) => !value)}
          onAddMember={chatrooms.addMember}
          onRemoveMember={(userId) => void chatrooms.removeMember(userId)}
          onSendMessage={composer.sendMessage}
          onMessageTextChange={composer.setMessageText}
          onUploadFile={(file) => void composer.uploadMediaBlob(file, file.name)}
          onToggleRecording={() => void composer.toggleRecording()}
          onLongPress={contextMenu.showContextMenu}
        />
      </main>

      <div
        id="context-menu"
        hidden={!contextMenu.contextMenu}
        ref={contextMenu.menuRef}
        style={
          contextMenu.contextMenu
            ? { left: contextMenu.contextMenu.x, top: contextMenu.contextMenu.y }
            : undefined
        }
      >
        <button
          type="button"
          id="context-copy-btn"
          onClick={() => void contextMenu.copyContextText()}
        >
          Copy
        </button>
        <button
          type="button"
          id="context-delete-btn"
          hidden={!chatrooms.isCreator}
          onClick={() => void contextMenu.deleteContextMessage()}
        >
          Delete
        </button>
      </div>
    </>
  );
}
