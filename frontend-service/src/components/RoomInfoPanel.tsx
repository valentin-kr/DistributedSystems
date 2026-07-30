import type { SyntheticEvent } from "react";
import type { ApiUser, Chatroom } from "../types";

type FormSubmitEvent = SyntheticEvent<HTMLFormElement>;

type RoomInfoPanelProps = {
  hidden: boolean;
  room: Chatroom | null;
  users: ApiUser[];
  isCreator: boolean;
  usernameFor: (userId: number) => string;
  onAddMember: (event: FormSubmitEvent) => void;
  onRemoveMember: (userId: number) => void;
};

export function RoomInfoPanel({
  hidden,
  room,
  users,
  isCreator,
  usernameFor,
  onAddMember,
  onRemoveMember,
}: RoomInfoPanelProps) {
  return (
    <div id="room-info-panel" hidden={hidden}>
      <p id="room-description-text">{room?.description || ""}</p>
      <p id="room-join-code">
        {room
          ? room.active
            ? `Join code: ${room.joinCode} - share this so others can join`
            : `Join code: ${room.joinCode} (chat expired, no longer joinable)`
          : ""}
      </p>
      <h4>Members</h4>
      <ul id="member-list">
        {room?.memberIds.map((memberId) => (
          <li key={memberId}>
            {usernameFor(memberId)}
            {memberId === room.creatorId ? " (creator)" : ""}
            {isCreator && memberId !== room.creatorId ? (
              <button
                type="button"
                className="inline-action"
                onClick={() => onRemoveMember(memberId)}
              >
                Remove
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      <form id="add-member-form" onSubmit={onAddMember}>
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
  );
}
