import {
  FormEvent,
  PointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { api, apiUrl } from "./api/client";
import { loadSession, saveSession } from "./auth/session";
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

const LONG_PRESS_MS = 500;

type ContextMenuState = {
  x: number;
  y: number;
  messageId: number;
  text: string;
};

function durationOptions(max: number, unit: "day" | "hour") {
  return Array.from({ length: max + 1 }, (_, value) => (
    <option key={value} value={value}>
      {value} {unit}
      {value === 1 ? "" : "s"}
    </option>
  ));
}

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

function messageTime(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
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

  async function requestCode(event: FormEvent<HTMLFormElement>) {
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

  async function verifyPhone(event: FormEvent<HTMLFormElement>) {
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

  async function createRoom(event: FormEvent<HTMLFormElement>) {
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

  async function joinRoom(event: FormEvent<HTMLFormElement>) {
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

  async function addMember(event: FormEvent<HTMLFormElement>) {
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

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
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

        <section id="screen-auth" className="screen" hidden={screen !== "auth"}>
          <button
            type="button"
            className="back-btn"
            id="auth-back-btn"
            onClick={() => void goBackFromFlow()}
          >
            &larr; Back
          </button>
          <h2>Verify your phone number</h2>
          <form id="request-code-form" onSubmit={requestCode}>
            <input
              id="phone-number"
              type="tel"
              placeholder="Phone number"
              required
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value)}
            />
            <button type="submit">Send code</button>
          </form>
          <form
            id="verify-form"
            hidden={!showVerifyForm}
            onSubmit={verifyPhone}
          >
            <input
              id="verify-code"
              placeholder="Verification code"
              required
              value={verifyCode}
              onChange={(event) => setVerifyCode(event.target.value)}
            />
            <input
              id="signup-username"
              placeholder="Choose a username (first time only)"
              value={signupUsername}
              onChange={(event) => setSignupUsername(event.target.value)}
            />
            <button type="submit">Verify &amp; continue</button>
          </form>
          <p id="simulated-sms-note" className="sms-note">
            {smsNote}
          </p>
          <p id="auth-error" className="error">
            {authError}
          </p>
        </section>

        <section
          id="screen-create-room"
          className="screen"
          hidden={screen !== "create-room"}
        >
          <button
            type="button"
            className="back-btn"
            id="create-room-back-btn"
            onClick={() => void goBackFromFlow()}
          >
            &larr; Back
          </button>
          <h2>Create a chatroom</h2>
          <form id="new-room-form" onSubmit={createRoom}>
            <input
              id="room-name"
              placeholder="Chat name"
              required
              value={roomName}
              onChange={(event) => setRoomName(event.target.value)}
            />
            <input
              id="room-description"
              placeholder="Short description"
              value={roomDescription}
              onChange={(event) => setRoomDescription(event.target.value)}
            />
            <div className="duration-row">
              <label>
                Days
                <select
                  id="duration-days"
                  value={durationDays}
                  onChange={(event) =>
                    setDurationDays(Number(event.target.value))
                  }
                >
                  {durationOptions(14, "day")}
                </select>
              </label>
              <label>
                Hours
                <select
                  id="duration-hours"
                  value={durationHours}
                  onChange={(event) =>
                    setDurationHours(Number(event.target.value))
                  }
                >
                  {durationOptions(23, "hour")}
                </select>
              </label>
            </div>
            <p id="duration-preview" className="sms-note">
              {durationPreview}
            </p>
            <button type="submit">Create room</button>
          </form>
          <p id="create-room-error" className="error">
            {createRoomError}
          </p>
        </section>

        <section
          id="screen-join-room"
          className="screen"
          hidden={screen !== "join-room"}
        >
          <button
            type="button"
            className="back-btn"
            id="join-room-back-btn"
            onClick={() => void goBackFromFlow()}
          >
            &larr; Back
          </button>
          <h2>Join a chatroom</h2>
          <form id="join-room-form" onSubmit={joinRoom}>
            <input
              id="join-code"
              placeholder="Join code"
              required
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value)}
            />
            <button type="submit">Join room</button>
          </form>
          <p id="join-error" className="error">
            {joinError}
          </p>
        </section>

        <section
          id="screen-room-list"
          className="screen"
          hidden={screen !== "room-list"}
        >
          <h2>Your chatrooms</h2>
          <div className="choice-row">
            <button
              type="button"
              id="room-list-create-btn"
              onClick={startCreateFlow}
            >
              Create a chatroom
            </button>
            <button
              type="button"
              id="room-list-join-btn"
              onClick={startJoinFlow}
            >
              Join a chatroom
            </button>
          </div>
          <p id="no-rooms-text" hidden={myRooms.length > 0}>
            You haven't joined any chatrooms yet.
          </p>
          <ul id="room-list">
            {myRooms.map((room) => (
              <li key={room.id} onClick={() => void enterRoom(room.id)}>
                {room.active ? room.name : `${room.name} (expired)`}
              </li>
            ))}
          </ul>
        </section>

        <section id="screen-room" className="screen" hidden={screen !== "room"}>
          <div className="room-header">
            <button
              type="button"
              className="back-btn"
              id="room-back-btn"
              onClick={() => void showRoomListScreen()}
            >
              &larr;
            </button>
            <div className="room-header-text">
              <h2 id="room-title">{currentRoom?.name || ""}</h2>
              <p
                id="room-status"
                className={currentRoom?.active ? "active" : "expired"}
              >
                {currentRoom
                  ? currentRoom.active
                    ? "Active"
                    : "Expired - read only"
                  : ""}
              </p>
            </div>
            <button
              type="button"
              id="room-info-btn"
              className="icon-btn"
              onClick={() => setShowInfo((value) => !value)}
            >
              Info
            </button>
          </div>

          <div id="room-info-panel" hidden={!showInfo}>
            <p id="room-description-text">{currentRoom?.description || ""}</p>
            <p id="room-join-code">
              {currentRoom
                ? currentRoom.active
                  ? `Join code: ${currentRoom.joinCode} - share this so others can join`
                  : `Join code: ${currentRoom.joinCode} (chat expired, no longer joinable)`
                : ""}
            </p>
            <h4>Members</h4>
            <ul id="member-list">
              {currentRoom?.memberIds.map((memberId) => (
                <li key={memberId}>
                  {usernameFor(memberId)}
                  {memberId === currentRoom.creatorId ? " (creator)" : ""}
                  {isCreator && memberId !== currentRoom.creatorId ? (
                    <button
                      type="button"
                      className="inline-action"
                      onClick={() => void removeMember(memberId)}
                    >
                      Remove
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
            <form id="add-member-form" onSubmit={addMember}>
              <select id="add-member-select" name="member">
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.username}
                  </option>
                ))}
              </select>
              <button type="submit">Add member</button>
            </form>
          </div>

          <div id="chat-thread" ref={threadRef}>
            {threadItems.map((item) => (
              <ThreadBubble
                key={`${item.kind}-${item.id}`}
                item={item}
                own={item.authorId === currentUser?.id}
                currentRoomId={currentRoomId}
                usernameFor={usernameFor}
                onLongPress={showContextMenu}
              />
            ))}
          </div>

          <form
            id="send-message-form"
            className="compose-bar"
            hidden={!currentRoom?.active}
            onSubmit={sendMessage}
          >
            <button
              type="button"
              id="attach-btn"
              className="icon-btn"
              onClick={() => fileInputRef.current?.click()}
            >
              +
            </button>
            <input
              id="media-file"
              type="file"
              hidden
              ref={fileInputRef}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                void uploadMediaBlob(file, file.name);
                event.target.value = "";
              }}
            />
            <input
              id="message-text"
              placeholder="Type a message"
              autoComplete="off"
              value={messageText}
              onChange={(event) => setMessageText(event.target.value)}
            />
            <button
              type="button"
              id="record-btn"
              className="icon-btn"
              onClick={() => void toggleRecording()}
            >
              {isRecording ? "Stop" : "Voice"}
            </button>
            <button type="submit">Send</button>
          </form>
          <p id="message-error" className="error">
            {messageError}
          </p>
          <p id="media-error" className="error">
            {mediaError}
          </p>
          <p id="record-status">{recordStatus}</p>
        </section>
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

type ThreadBubbleProps = {
  item: ThreadItem;
  own: boolean;
  currentRoomId: number | null;
  usernameFor: (userId: number) => string;
  onLongPress: (
    event: PointerEvent<HTMLDivElement>,
    messageId: number,
    text: string,
  ) => void;
};

function ThreadBubble({
  item,
  own,
  currentRoomId,
  usernameFor,
  onLongPress,
}: ThreadBubbleProps) {
  const timerRef = useRef<number | null>(null);
  const firedLongPressRef = useRef(false);

  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    if (item.kind !== "message") return;
    firedLongPressRef.current = false;
    timerRef.current = window.setTimeout(() => {
      firedLongPressRef.current = true;
      onLongPress(event, item.id, item.text);
    }, LONG_PRESS_MS);
  }

  function cancelLongPress() {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  return (
    <div
      className={`bubble ${own ? "own" : "other"}`}
      onPointerDown={pointerDown}
      onPointerUp={cancelLongPress}
      onPointerCancel={cancelLongPress}
      onClickCapture={(event) => {
        if (firedLongPressRef.current) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
    >
      {!own ? (
        <div className="bubble-sender">{usernameFor(item.authorId)}</div>
      ) : null}
      {item.kind === "message" ? (
        <div className="bubble-text">{item.text}</div>
      ) : null}
      {item.kind === "media" ? (
        <MediaContent item={item} currentRoomId={currentRoomId} />
      ) : null}
      <div className="bubble-footer">
        <span className="bubble-time">{messageTime(item.timestamp)}</span>
      </div>
    </div>
  );
}

function MediaContent({
  item,
  currentRoomId,
}: {
  item: Extract<ThreadItem, { kind: "media" }>;
  currentRoomId: number | null;
}) {
  if (!currentRoomId) return null;
  const url = apiUrl(`/chatrooms/${currentRoomId}/media/${item.id}`);

  if (item.contentType?.startsWith("audio/")) {
    return <audio controls src={url} />;
  }
  if (item.contentType?.startsWith("image/")) {
    return <img src={url} className="bubble-image" alt={item.filename} />;
  }
  return (
    <a href={url} target="_blank" rel="noreferrer">
      {item.filename}
    </a>
  );
}
