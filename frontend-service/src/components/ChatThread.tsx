import { useRef } from "react";
import type { PointerEvent, RefObject } from "react";
import { apiUrl } from "../api/client";
import type { ThreadItem } from "../types";
import { parseServerTimestamp } from "../utils/time";

const LONG_PRESS_MS = 500;

export type ChatThreadLongPress = (
  event: PointerEvent<HTMLDivElement>,
  messageId: number,
  text: string,
) => void;

type ChatThreadProps = {
  threadRef: RefObject<HTMLDivElement | null>;
  items: ThreadItem[];
  currentUserId?: number;
  currentRoomId: number | null;
  usernameFor: (userId: number) => string;
  onLongPress: ChatThreadLongPress;
};

export function ChatThread({
  threadRef,
  items,
  currentUserId,
  currentRoomId,
  usernameFor,
  onLongPress,
}: ChatThreadProps) {
  return (
    <div id="chat-thread" ref={threadRef}>
      {items.map((item) => (
        <ThreadBubble
          key={`${item.kind}-${item.id}`}
          item={item}
          own={item.authorId === currentUserId}
          currentRoomId={currentRoomId}
          usernameFor={usernameFor}
          onLongPress={onLongPress}
        />
      ))}
    </div>
  );
}

type ThreadBubbleProps = {
  item: ThreadItem;
  own: boolean;
  currentRoomId: number | null;
  usernameFor: (userId: number) => string;
  onLongPress: ChatThreadLongPress;
};

function messageTime(timestamp: string) {
  return parseServerTimestamp(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

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
