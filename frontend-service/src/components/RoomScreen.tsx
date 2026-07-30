import type { RefObject, SyntheticEvent } from "react";
import { ArrowLeft, Info, Mic, Paperclip, Send, Square } from "lucide-react";
import { ChatThread } from "./ChatThread";
import { RoomInfoPanel } from "./RoomInfoPanel";
import type { ChatThreadLongPress } from "./ChatThread";
import type { ApiUser, Chatroom, SessionUser, ThreadItem } from "../types";

type FormSubmitEvent = SyntheticEvent<HTMLFormElement>;

type RoomScreenProps = {
  hidden: boolean;
  room: Chatroom | null;
  users: ApiUser[];
  currentUser: SessionUser | null;
  currentRoomId: number | null;
  threadItems: ThreadItem[];
  showInfo: boolean;
  isCreator: boolean;
  messageText: string;
  messageError: string;
  mediaError: string;
  recordStatus: string;
  isRecording: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  threadRef: RefObject<HTMLDivElement | null>;
  usernameFor: (userId: number) => string;
  onBack: () => void;
  onToggleInfo: () => void;
  onAddMember: (event: FormSubmitEvent) => void;
  onRemoveMember: (userId: number) => void;
  onSendMessage: (event: FormSubmitEvent) => void;
  onMessageTextChange: (value: string) => void;
  onUploadFile: (file: File) => void;
  onToggleRecording: () => void;
  onLongPress: ChatThreadLongPress;
};

export function RoomScreen({
  hidden,
  room,
  users,
  currentUser,
  currentRoomId,
  threadItems,
  showInfo,
  isCreator,
  messageText,
  messageError,
  mediaError,
  recordStatus,
  isRecording,
  fileInputRef,
  threadRef,
  usernameFor,
  onBack,
  onToggleInfo,
  onAddMember,
  onRemoveMember,
  onSendMessage,
  onMessageTextChange,
  onUploadFile,
  onToggleRecording,
  onLongPress,
}: RoomScreenProps) {
  return (
    <section id="screen-room" className="screen" hidden={hidden}>
      <div className="room-header">
        <button
          type="button"
          className="back-btn"
          id="room-back-btn"
          onClick={onBack}
        >
          <ArrowLeft size={20} aria-hidden="true" />
          <span className="sr-only">Back to chatrooms</span>
        </button>
        <div className="room-header-text">
          <h2 id="room-title">{room?.name || ""}</h2>
          <p id="room-status" className={room?.active ? "active" : "expired"}>
            {room ? (room.active ? "Active" : "Expired - read only") : ""}
          </p>
        </div>
        <button
          type="button"
          id="room-info-btn"
          className="icon-btn"
          onClick={onToggleInfo}
        >
          <Info size={18} aria-hidden="true" />
          <span>Info</span>
        </button>
      </div>

      <RoomInfoPanel
        hidden={!showInfo}
        room={room}
        users={users}
        isCreator={isCreator}
        usernameFor={usernameFor}
        onAddMember={onAddMember}
        onRemoveMember={onRemoveMember}
      />

      <ChatThread
        threadRef={threadRef}
        items={threadItems}
        currentUserId={currentUser?.id}
        currentRoomId={currentRoomId}
        usernameFor={usernameFor}
        onLongPress={onLongPress}
      />

      <form
        id="send-message-form"
        className="compose-bar"
        hidden={!room?.active}
        onSubmit={onSendMessage}
      >
        <button
          type="button"
          id="attach-btn"
          className="icon-btn"
          onClick={() => fileInputRef.current?.click()}
        >
          <Paperclip size={19} aria-hidden="true" />
          <span className="sr-only">Attach file</span>
        </button>
        <input
          id="media-file"
          type="file"
          hidden
          ref={fileInputRef}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            onUploadFile(file);
            event.target.value = "";
          }}
        />
        <input
          id="message-text"
          placeholder="Type a message"
          autoComplete="off"
          value={messageText}
          onChange={(event) => onMessageTextChange(event.target.value)}
        />
        <button
          type="button"
          id="record-btn"
          className="icon-btn"
          onClick={onToggleRecording}
          aria-pressed={isRecording}
        >
          {isRecording ? (
            <Square size={17} fill="currentColor" aria-hidden="true" />
          ) : (
            <Mic size={19} aria-hidden="true" />
          )}
          <span className="sr-only">
            {isRecording ? "Stop recording" : "Record voice message"}
          </span>
        </button>
        <button type="submit" className="send-btn" aria-label="Send message">
          <Send size={18} aria-hidden="true" />
          <span className="send-label">Send</span>
        </button>
      </form>
      <p id="message-error" className="error">
        {messageError}
      </p>
      <p id="media-error" className="error">
        {mediaError}
      </p>
      <p id="record-status">{recordStatus}</p>
    </section>
  );
}
