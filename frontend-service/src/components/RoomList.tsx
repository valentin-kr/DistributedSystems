import type { Chatroom } from "../types";

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
      <h2>Your chatrooms</h2>
      <div className="choice-row">
        <button type="button" id="room-list-create-btn" onClick={onCreate}>
          Create a chatroom
        </button>
        <button type="button" id="room-list-join-btn" onClick={onJoin}>
          Join a chatroom
        </button>
      </div>
      <p id="no-rooms-text" hidden={rooms.length > 0}>
        You haven't joined any chatrooms yet.
      </p>
      <ul id="room-list">
        {rooms.map((room) => (
          <li key={room.id} onClick={() => onEnterRoom(room.id)}>
            {room.active ? room.name : `${room.name} (expired)`}
          </li>
        ))}
      </ul>
    </section>
  );
}
