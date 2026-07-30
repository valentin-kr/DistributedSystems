import type { SyntheticEvent } from "react";

type FormSubmitEvent = SyntheticEvent<HTMLFormElement>;

type JoinRoomProps = {
  hidden: boolean;
  joinCode: string;
  joinError: string;
  onBack: () => void;
  onSubmit: (event: FormSubmitEvent) => void;
  onJoinCodeChange: (value: string) => void;
};

export function JoinRoom({
  hidden,
  joinCode,
  joinError,
  onBack,
  onSubmit,
  onJoinCodeChange,
}: JoinRoomProps) {
  return (
    <section id="screen-join-room" className="screen" hidden={hidden}>
      <button
        type="button"
        className="back-btn"
        id="join-room-back-btn"
        onClick={onBack}
      >
        &larr; Back
      </button>
      <h2>Join a chatroom</h2>
      <form id="join-room-form" onSubmit={onSubmit}>
        <input
          id="join-code"
          placeholder="Join code"
          required
          value={joinCode}
          onChange={(event) => onJoinCodeChange(event.target.value)}
        />
        <button type="submit">Join room</button>
      </form>
      <p id="join-error" className="error">
        {joinError}
      </p>
    </section>
  );
}
