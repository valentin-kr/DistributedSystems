import type { Chatroom } from "../types";
import {
  ArrowRight,
  Clock3,
  LogIn,
  MessageCircle,
  Plus,
  Users,
} from "lucide-react";

type RoomListProps = {
  hidden: boolean;
  rooms: Chatroom[];
  onCreate: () => void;
  onJoin: () => void;
  onEnterRoom: (roomId: number) => void;
};

export function RoomList({
  hidden,
  rooms,
  onCreate,
  onJoin,
  onEnterRoom,
}: RoomListProps) {
  return (
    <section id="screen-room-list" className="screen" hidden={hidden}>
      <div className="room-list-heading">
        <div>
          <span className="eyebrow">Your conversations</span>
          <h2>Chatrooms</h2>
          <p>Pick up where you left off or start something new.</p>
        </div>
        <span className="room-count">
          {rooms.length} {rooms.length === 1 ? "room" : "rooms"}
        </span>
      </div>
      <div className="choice-row">
        <button type="button" id="room-list-create-btn" onClick={onCreate}>
          <Plus size={18} aria-hidden="true" />
          Create room
        </button>
        <button type="button" id="room-list-join-btn" onClick={onJoin}>
          <LogIn size={18} aria-hidden="true" />
          Join room
        </button>
      </div>
      <div id="no-rooms-text" className="empty-state" hidden={rooms.length > 0}>
        <span className="empty-state-icon" aria-hidden="true">
          <MessageCircle size={28} />
        </span>
        <h3>No chatrooms yet</h3>
        <p>Create one or join with an invite code to get started.</p>
      </div>
      <ul id="room-list">
        {rooms.map((room) => (
          <li key={room.id}>
            <button
              type="button"
              className="room-card"
              onClick={() => onEnterRoom(room.id)}
            >
              <span
                className={`room-card-icon ${room.active ? "" : "expired"}`}
              >
                {room.active ? (
                  <MessageCircle size={21} aria-hidden="true" />
                ) : (
                  <Clock3 size={21} aria-hidden="true" />
                )}
              </span>
              <span className="room-card-copy">
                <span className="room-card-title-row">
                  <strong>{room.name}</strong>
                  <span
                    className={`status-badge ${room.active ? "active" : "expired"}`}
                  >
                    {room.active ? "Active" : "Expired"}
                  </span>
                </span>
                <span className="room-card-description">
                  {room.description || "No description"}
                </span>
                <span className="room-card-meta">
                  <Users size={14} aria-hidden="true" />
                  {room.memberIds.length}{" "}
                  {room.memberIds.length === 1 ? "member" : "members"}
                </span>
              </span>
              <ArrowRight
                className="room-card-arrow"
                size={20}
                aria-hidden="true"
              />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
