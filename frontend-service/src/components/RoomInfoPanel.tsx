import type { SyntheticEvent } from "react";
import { KeyRound, UserPlus, Users, X } from "lucide-react";
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
      <div id="room-join-code">
        <KeyRound size={18} aria-hidden="true" />
        <span>
          <small>Join code</small>
          <strong>{room?.joinCode}</strong>
        </span>
        <span className="join-code-note">
          {room?.active ? "Share to invite others" : "Room no longer joinable"}
        </span>
      </div>
      <h4>
        <Users size={17} aria-hidden="true" />
        Members
      </h4>
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
                <X size={14} aria-hidden="true" />
                <span>Remove</span>
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
        <button type="submit">
          <UserPlus size={17} aria-hidden="true" />
          Add member
        </button>
      </form>
    </div>
  );
}
