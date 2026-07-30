import type { SyntheticEvent } from "react";

type FormSubmitEvent = SyntheticEvent<HTMLFormElement>;

type CreateRoomProps = {
  hidden: boolean;
  roomName: string;
  roomDescription: string;
  durationDays: number;
  durationHours: number;
  durationPreview: string;
  createRoomError: string;
  onBack: () => void;
  onSubmit: (event: FormSubmitEvent) => void;
  onRoomNameChange: (value: string) => void;
  onRoomDescriptionChange: (value: string) => void;
  onDurationDaysChange: (value: number) => void;
  onDurationHoursChange: (value: number) => void;
};

function durationOptions(max: number, unit: "day" | "hour") {
  return Array.from({ length: max + 1 }, (_, value) => (
    <option key={value} value={value}>
      {value} {unit}
      {value === 1 ? "" : "s"}
    </option>
  ));
}

export function CreateRoom({
  hidden,
  roomName,
  roomDescription,
  durationDays,
  durationHours,
  durationPreview,
  createRoomError,
  onBack,
  onSubmit,
  onRoomNameChange,
  onRoomDescriptionChange,
  onDurationDaysChange,
  onDurationHoursChange,
}: CreateRoomProps) {
  return (
    <section id="screen-create-room" className="screen" hidden={hidden}>
      <button
        type="button"
        className="back-btn"
        id="create-room-back-btn"
        onClick={onBack}
      >
        &larr; Back
      </button>
      <h2>Create a chatroom</h2>
      <form id="new-room-form" onSubmit={onSubmit}>
        <input
          id="room-name"
          placeholder="Chat name"
          required
          value={roomName}
          onChange={(event) => onRoomNameChange(event.target.value)}
        />
        <input
          id="room-description"
          placeholder="Short description"
          value={roomDescription}
          onChange={(event) => onRoomDescriptionChange(event.target.value)}
        />
        <div className="duration-row">
          <label>
            Days
            <select
              id="duration-days"
              value={durationDays}
              onChange={(event) =>
                onDurationDaysChange(Number(event.target.value))
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
                onDurationHoursChange(Number(event.target.value))
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
  );
}
