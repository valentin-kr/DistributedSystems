import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SyntheticEvent } from "react";
import { api } from "../api/client";
import type {
  ApiUser,
  Chatroom,
  Media,
  Message,
  SessionUser,
  ThreadItem,
} from "../types";
import { formatEndTime, parseServerTimestamp } from "../utils/time";

type FormSubmitEvent = SyntheticEvent<HTMLFormElement>;

type UseChatroomsOptions = {
  currentUser: SessionUser | null;
  onRoomLoaded: () => void;
};

const ACTIVITY_REFRESH_DELAY_MS = 350;

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function useChatrooms({
  currentUser,
  onRoomLoaded,
}: UseChatroomsOptions) {
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [rooms, setRooms] = useState<Chatroom[]>([]);
  const [currentRoomId, setCurrentRoomId] = useState<number | null>(null);
  const [currentRoom, setCurrentRoom] = useState<Chatroom | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [media, setMedia] = useState<Media[]>([]);
  const [showInfo, setShowInfo] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [roomDescription, setRoomDescription] = useState("");
  const [durationDays, setDurationDays] = useState(1);
  const [durationHours, setDurationHours] = useState(0);
  const [createRoomError, setCreateRoomError] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const threadRef = useRef<HTMLDivElement | null>(null);

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
        parseServerTimestamp(a.timestamp).getTime() -
        parseServerTimestamp(b.timestamp).getTime(),
    );
  }, [messages, media]);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
  }, [threadItems]);

  const usernameFor = useCallback(
    (userId: number) => {
      const user = users.find((candidate) => candidate.id === userId);
      if (user?.display_name || user?.username) {
        return user.display_name || user.username;
      }
      if (currentUser?.id === userId) {
        return currentUser.displayName;
      }
      return `User ${userId}`;
    },
    [currentUser, users],
  );

  const loadUsers = useCallback(async () => {
    const nextUsers = await api<ApiUser[]>("/users");
    setUsers(nextUsers);
    return nextUsers;
  }, []);

  const loadRoomsList = useCallback(async () => {
    const nextRooms = await api<Chatroom[]>("/chatrooms");
    setRooms(nextRooms);
    return nextRooms;
  }, []);

  const loadRoomDetail = useCallback(
    async (roomId: number) => {
      const [room, nextMessages, nextMedia] = await Promise.all([
        api<Chatroom>(`/chatrooms/${roomId}`),
        api<Message[]>(`/chatrooms/${roomId}/messages`),
        api<Media[]>(`/chatrooms/${roomId}/media`),
      ]);
      setCurrentRoom(room);
      setMessages(nextMessages);
      setMedia(nextMedia);
      onRoomLoaded();
      return room;
    },
    [onRoomLoaded],
  );

  const reloadThread = useCallback(async () => {
    if (!currentRoomId) return;
    const [nextMessages, nextMedia] = await Promise.all([
      api<Message[]>(`/chatrooms/${currentRoomId}/messages`),
      api<Media[]>(`/chatrooms/${currentRoomId}/media`),
    ]);
    setMessages(nextMessages);
    setMedia(nextMedia);
    await wait(ACTIVITY_REFRESH_DELAY_MS);
    await loadUsers();
  }, [currentRoomId, loadUsers]);

  const showRoomListScreen = useCallback(async () => {
    await Promise.all([loadUsers(), loadRoomsList()]);
    setCurrentRoomId(null);
    setCurrentRoom(null);
    setShowInfo(false);
  }, [loadRoomsList, loadUsers]);

  const enterRoom = useCallback(
    async (roomId: number) => {
      setCurrentRoomId(roomId);
      setShowInfo(false);
      await loadUsers();
      await loadRoomDetail(roomId);
    },
    [loadRoomDetail, loadUsers],
  );

  async function createRoom(event: FormSubmitEvent) {
    event.preventDefault();
    if (!currentUser) return false;
    setCreateRoomError("");

    if (totalHours <= 0) {
      setCreateRoomError("Pick a duration of at least 1 hour");
      return false;
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
      return true;
    } catch (err) {
      setCreateRoomError(
        err instanceof Error ? err.message : "Room creation failed",
      );
      return false;
    }
  }

  async function joinRoom(event: FormSubmitEvent) {
    event.preventDefault();
    if (!currentUser) return false;
    setJoinError("");
    try {
      const room = await api<Chatroom>("/chatrooms/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: joinCode, userId: currentUser.id }),
      });
      setJoinCode("");
      await enterRoom(room.id);
      return true;
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : "Join failed");
      return false;
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

  function resetRooms() {
    setCurrentRoomId(null);
    setCurrentRoom(null);
    setUsers([]);
    setRooms([]);
  }

  return {
    users,
    currentRoomId,
    currentRoom,
    showInfo,
    roomName,
    roomDescription,
    durationDays,
    durationHours,
    durationPreview,
    createRoomError,
    joinCode,
    joinError,
    isCreator,
    myRooms,
    threadItems,
    threadRef,
    usernameFor,
    reloadThread,
    showRoomListScreen,
    enterRoom,
    createRoom,
    joinRoom,
    addMember,
    removeMember,
    resetRooms,
    setShowInfo,
    setRoomName,
    setRoomDescription,
    setDurationDays,
    setDurationHours,
    setJoinCode,
  };
}
