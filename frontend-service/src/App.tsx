import {
  PointerEvent,
  SyntheticEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { api } from "./api/client";
import { loadSession, saveSession } from "./auth/session";
import { AuthFlow } from "./components/AuthFlow";
import { CreateRoom } from "./components/CreateRoom";
import { JoinRoom } from "./components/JoinRoom";
import { RoomList } from "./components/RoomList";
import { RoomScreen } from "./components/RoomScreen";
import type {
  ApiUser,
  Chatroom,
  FlowIntent,
  Media,
  Message,
  Screen,
  SessionUser,
  ThreadItem,
} from "./types";

type ContextMenuState = {
  x: number;
  y: number;
  messageId: number;
  text: string;
};

type FormSubmitEvent = SyntheticEvent<HTMLFormElement>;

function formatEndTime(totalHours: number) {
  if (totalHours <= 0) {
    return "Pick a duration of at least 1 hour";
  }
  const finishAt = new Date(Date.now() + totalHours * 3600 * 1000);
  return `Chat will end on ${finishAt.toLocaleDateString()} at ${finishAt.toLocaleTimeString(
    [],
    {
      hour: "2-digit",
      minute: "2-digit",
    },
  )}`;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("choice");
  const [intent, setIntent] = useState<FlowIntent>(null);
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(() =>
    loadSession(),
  );
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [rooms, setRooms] = useState<Chatroom[]>([]);
  const [currentRoomId, setCurrentRoomId] = useState<number | null>(null);
  const [currentRoom, setCurrentRoom] = useState<Chatroom | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [media, setMedia] = useState<Media[]>([]);
  const [showInfo, setShowInfo] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const [phoneNumber, setPhoneNumber] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [signupUsername, setSignupUsername] = useState("");
  const [smsNote, setSmsNote] = useState("");
  const [authError, setAuthError] = useState("");
  const [showVerifyForm, setShowVerifyForm] = useState(false);

  const [roomName, setRoomName] = useState("");
  const [roomDescription, setRoomDescription] = useState("");
  const [durationDays, setDurationDays] = useState(1);
  const [durationHours, setDurationHours] = useState(0);
  const [createRoomError, setCreateRoomError] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [messageText, setMessageText] = useState("");
  const [messageError, setMessageError] = useState("");
  const [mediaError, setMediaError] = useState("");
  const [recordStatus, setRecordStatus] = useState("");
  const [isRecording, setIsRecording] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const isCreator = Boolean(
    currentUser && currentRoom && currentRoom.creatorId === currentUser.id,
  );
  const totalHours = durationDays * 24 + durationHours;
  const durationPreview = formatEndTime(totalHours);

  const myRooms = useMemo(() => {
    if (!currentUser) return [];
    return rooms.filter((room) => room.memberIds.includes(currentUser.id));
  }, [rooms, currentUser]);

  const threadItems = useMemo<ThreadItem[]>(() => {
    const items: ThreadItem[] = [
      ...messages.map((message) => ({
        kind: "message" as const,
        id: message.id,
        authorId: message.authorID,
        text: message.text,
        timestamp: message.timestamp,
      })),
      ...media.map((item) => ({
        kind: "media" as const,
        id: item.id,
        authorId: item.uploaderId,
        filename: item.filename,
        contentType: item.contentType,
        timestamp: item.uploadedAt,
      })),
    ];
    return items.sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
  }, [messages, media]);

  useEffect(() => {
    saveSession(currentUser);
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      void showRoomListScreen();
    }
  }, []);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
  }, [threadItems]);

  useEffect(() => {
    const hideOnOutsidePointer = (event: globalThis.PointerEvent) => {
      if (
        contextMenu &&
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setContextMenu(null);
      }
    };
    document.addEventListener("pointerdown", hideOnOutsidePointer);
    return () =>
      document.removeEventListener("pointerdown", hideOnOutsidePointer);
  }, [contextMenu]);

  function usernameFor(userId: number) {
    if (currentUser?.id === userId) return currentUser.username;
    return (
      users.find((user) => user.id === userId)?.username || `User ${userId}`
    );
  }

  async function loadUsers() {
    const nextUsers = await api<ApiUser[]>("/users");
    setUsers(nextUsers);
    return nextUsers;
  }

  async function loadRoomsList() {
    const nextRooms = await api<Chatroom[]>("/chatrooms");
    setRooms(nextRooms);
    return nextRooms;
  }

  async function loadRoomDetail(roomId: number) {
    const [room, nextMessages, nextMedia] = await Promise.all([
      api<Chatroom>(`/chatrooms/${roomId}`),
      api<Message[]>(`/chatrooms/${roomId}/messages`),
      api<Media[]>(`/chatrooms/${roomId}/media`),
    ]);
    setCurrentRoom(room);
    setMessages(nextMessages);
    setMedia(nextMedia);
    setMessageError("");
    return room;
  }

  async function reloadThread() {
    if (!currentRoomId) return;
    const [nextMessages, nextMedia] = await Promise.all([
      api<Message[]>(`/chatrooms/${currentRoomId}/messages`),
      api<Media[]>(`/chatrooms/${currentRoomId}/media`),
    ]);
    setMessages(nextMessages);
    setMedia(nextMedia);
  }

  function goToChoice() {
    setIntent(null);
    setScreen("choice");
  }

  async function goBackFromFlow() {
    if (currentUser) {
      await showRoomListScreen();
    } else {
      goToChoice();
    }
  }

  function startCreateFlow() {
    setIntent("create");
    setScreen(currentUser ? "create-room" : "auth");
  }

  function startJoinFlow() {
    setIntent("join");
    setScreen(currentUser ? "join-room" : "auth");
  }

  async function showRoomListScreen() {
    await Promise.all([loadUsers(), loadRoomsList()]);
    setCurrentRoomId(null);
    setCurrentRoom(null);
    setShowInfo(false);
    setScreen("room-list");
  }

  async function enterRoom(roomId: number) {
    setCurrentRoomId(roomId);
    setShowInfo(false);
    await loadUsers();
    await loadRoomDetail(roomId);
    setScreen("room");
  }

  async function requestCode(event: FormSubmitEvent) {
    event.preventDefault();
    setAuthError("");
    try {
      const result = await api<{ code: string }>("/auth/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber }),
      });
      setSmsNote(
        `Simulated SMS - your code is ${result.code} (a real deployment would text this to your phone instead)`,
      );
      setVerifyCode(result.code);
      setShowVerifyForm(true);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Auth request failed");
    }
  }

  async function verifyPhone(event: FormSubmitEvent) {
    event.preventDefault();
    setAuthError("");
    try {
      const user = await api<ApiUser & { token: string }>("/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber,
          code: verifyCode,
          username: signupUsername || undefined,
        }),
      });
      const nextUser: SessionUser = {
        id: user.id,
        username: user.username,
        phoneNumber: user.phone_number,
        token: user.token,
      };
      setCurrentUser(nextUser);

      if (intent === "create") {
        setScreen("create-room");
      } else if (intent === "join") {
        setScreen("join-room");
      } else {
        await showRoomListScreen();
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Verification failed");
    }
  }

  function logout() {
    setCurrentUser(null);
    setCurrentRoomId(null);
    setCurrentRoom(null);
    setIntent(null);
    setUsers([]);
    setRooms([]);
    goToChoice();
  }

  async function createRoom(event: FormSubmitEvent) {
    event.preventDefault();
    if (!currentUser) return;
    setCreateRoomError("");

    if (totalHours <= 0) {
      setCreateRoomError("Pick a duration of at least 1 hour");
      return;
    }

    try {
      const room = await api<Chatroom>("/chatrooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: roomName,
          description: roomDescription,
          expiryHours: totalHours,
          userId: currentUser.id,
        }),
      });
      setRoomName("");
      setRoomDescription("");
      await enterRoom(room.id);
    } catch (err) {
      setCreateRoomError(
        err instanceof Error ? err.message : "Room creation failed",
      );
    }
  }

  async function joinRoom(event: FormSubmitEvent) {
    event.preventDefault();
    if (!currentUser) return;
    setJoinError("");
    try {
      const room = await api<Chatroom>("/chatrooms/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: joinCode, userId: currentUser.id }),
      });
      setJoinCode("");
      await enterRoom(room.id);
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : "Join failed");
    }
  }

  async function addMember(event: FormSubmitEvent) {
    event.preventDefault();
    if (!currentRoomId) return;
    const select = event.currentTarget.elements.namedItem(
      "member",
    ) as HTMLSelectElement | null;
    const userId = Number(select?.value);
    if (!userId) return;
    await api<Chatroom>(`/chatrooms/${currentRoomId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    await loadRoomDetail(currentRoomId);
  }

  async function removeMember(userId: number) {
    if (!currentRoomId || !currentUser) return;
    await api<void>(
      `/chatrooms/${currentRoomId}/members/${userId}?requesterId=${currentUser.id}`,
      {
        method: "DELETE",
      },
    );
    await loadRoomDetail(currentRoomId);
  }

  async function sendMessage(event: FormSubmitEvent) {
    event.preventDefault();
    if (!currentRoomId || !currentUser || !messageText.trim()) return;
    setMessageError("");
    try {
      await api<Message>(`/chatrooms/${currentRoomId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: messageText, userId: currentUser.id }),
      });
      setMessageText("");
      await reloadThread();
    } catch (err) {
      setMessageError(err instanceof Error ? err.message : "Message failed");
    }
  }

  async function deleteMessage(messageId: number) {
    if (!currentRoomId || !currentUser) return;
    await api<void>(
      `/chatrooms/${currentRoomId}/messages/${messageId}?requesterId=${currentUser.id}`,
      {
        method: "DELETE",
      },
    );
    await reloadThread();
  }

  async function uploadMediaBlob(blob: Blob, filename: string) {
    if (!currentRoomId || !currentUser) return;
    setMediaError("");
    const formData = new FormData();
    formData.append("file", blob, filename);
    const username = encodeURIComponent(usernameFor(currentUser.id));

    try {
      await api<Media>(
        `/chatrooms/${currentRoomId}/media?userId=${currentUser.id}&username=${username}`,
        {
          method: "POST",
          body: formData,
        },
      );
      await reloadThread();
    } catch (err) {
      setMediaError(err instanceof Error ? err.message : "Upload failed");
    }
  }

  async function toggleRecording() {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordedChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        setIsRecording(false);
        setRecordStatus("Uploading voice message...");
        const blob = new Blob(recordedChunksRef.current, {
          type: "audio/webm",
        });
        await uploadMediaBlob(blob, `voice-${Date.now()}.webm`);
        setRecordStatus("");
      };

      recorder.start();
      setIsRecording(true);
      setRecordStatus("Recording...");
    } catch (err) {
      setRecordStatus(
        `Microphone error: ${err instanceof Error ? err.message : "Unable to start recording"}`,
      );
    }
  }

  function showContextMenu(
    event: PointerEvent<HTMLDivElement>,
    messageId: number,
    text: string,
  ) {
    const menuWidth = 130;
    const menuHeight = 88;
    setContextMenu({
      x: Math.min(event.clientX, window.innerWidth - menuWidth - 8),
      y: Math.min(event.clientY, window.innerHeight - menuHeight - 8),
      messageId,
      text,
    });
  }

  async function copyContextText() {
    if (contextMenu) {
      try {
        await navigator.clipboard.writeText(contextMenu.text);
      } catch {
        // Clipboard API may be unavailable in some demo browsers.
      }
    }
    setContextMenu(null);
  }

  async function deleteContextMessage() {
    if (contextMenu) {
      await deleteMessage(contextMenu.messageId);
    }
    setContextMenu(null);
  }

  return (
    <>
      <header>
        <h1>TimeChat</h1>
        <div id="logged-in-view" hidden={!currentUser}>
          <span id="logged-in-as">
            {currentUser ? `Logged in as ${currentUser.username}` : ""}
          </span>
          <button id="logout-btn" type="button" onClick={logout}>
            Log out
          </button>
        </div>
      </header>

      <main>
        <section
          id="screen-choice"
          className="screen"
          hidden={screen !== "choice"}
        >
          <h2>What would you like to do?</h2>
          <button
            id="choice-create-btn"
            className="big-choice"
            type="button"
            onClick={startCreateFlow}
          >
            Create a chatroom
          </button>
          <button
            id="choice-join-btn"
            className="big-choice"
            type="button"
            onClick={startJoinFlow}
          >
            Join a chatroom
          </button>
        </section>

        <AuthFlow
          hidden={screen !== "auth"}
          phoneNumber={phoneNumber}
          verifyCode={verifyCode}
          signupUsername={signupUsername}
          smsNote={smsNote}
          authError={authError}
          showVerifyForm={showVerifyForm}
          onBack={() => void goBackFromFlow()}
          onRequestCode={requestCode}
          onVerifyPhone={verifyPhone}
          onPhoneNumberChange={setPhoneNumber}
          onVerifyCodeChange={setVerifyCode}
          onSignupUsernameChange={setSignupUsername}
        />

        <CreateRoom
          hidden={screen !== "create-room"}
          roomName={roomName}
          roomDescription={roomDescription}
          durationDays={durationDays}
          durationHours={durationHours}
          durationPreview={durationPreview}
          createRoomError={createRoomError}
          onBack={() => void goBackFromFlow()}
          onSubmit={createRoom}
          onRoomNameChange={setRoomName}
          onRoomDescriptionChange={setRoomDescription}
          onDurationDaysChange={setDurationDays}
          onDurationHoursChange={setDurationHours}
        />

        <JoinRoom
          hidden={screen !== "join-room"}
          joinCode={joinCode}
          joinError={joinError}
          onBack={() => void goBackFromFlow()}
          onSubmit={joinRoom}
          onJoinCodeChange={setJoinCode}
        />

        <RoomList
          hidden={screen !== "room-list"}
          rooms={myRooms}
          onCreate={startCreateFlow}
          onJoin={startJoinFlow}
          onEnterRoom={(roomId) => void enterRoom(roomId)}
        />

        <RoomScreen
          hidden={screen !== "room"}
          room={currentRoom}
          users={users}
          currentUser={currentUser}
          currentRoomId={currentRoomId}
          threadItems={threadItems}
          showInfo={showInfo}
          isCreator={isCreator}
          messageText={messageText}
          messageError={messageError}
          mediaError={mediaError}
          recordStatus={recordStatus}
          isRecording={isRecording}
          fileInputRef={fileInputRef}
          threadRef={threadRef}
          usernameFor={usernameFor}
          onBack={() => void showRoomListScreen()}
          onToggleInfo={() => setShowInfo((value) => !value)}
          onAddMember={addMember}
          onRemoveMember={(userId) => void removeMember(userId)}
          onSendMessage={sendMessage}
          onMessageTextChange={setMessageText}
          onUploadFile={(file) => void uploadMediaBlob(file, file.name)}
          onToggleRecording={() => void toggleRecording()}
          onLongPress={showContextMenu}
        />
      </main>

      <div
        id="context-menu"
        hidden={!contextMenu}
        ref={menuRef}
        style={
          contextMenu ? { left: contextMenu.x, top: contextMenu.y } : undefined
        }
      >
        <button
          type="button"
          id="context-copy-btn"
          onClick={() => void copyContextText()}
        >
          Copy
        </button>
        <button
          type="button"
          id="context-delete-btn"
          hidden={!isCreator}
          onClick={() => void deleteContextMessage()}
        >
          Delete
        </button>
      </div>
    </>
  );
}
