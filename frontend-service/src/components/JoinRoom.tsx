import type { SyntheticEvent } from "react";
import { ArrowLeft, KeyRound, LogIn } from "lucide-react";

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
        <ArrowLeft size={18} aria-hidden="true" />
        <span>Back</span>
      </button>
      <div className="screen-heading">
        <span className="screen-icon" aria-hidden="true">
          <KeyRound size={22} />
        </span>
        <div>
          <span className="eyebrow">Have an invite?</span>
          <h2>Join a chatroom</h2>
          <p>Enter the six-character code shared by the room creator.</p>
        </div>
      </div>
      <form id="join-room-form" onSubmit={onSubmit}>
        <input
          id="join-code"
          placeholder="Join code"
          required
          value={joinCode}
          onChange={(event) => onJoinCodeChange(event.target.value)}
        />
        <button type="submit">
          <LogIn size={18} aria-hidden="true" />
          Join room
        </button>
      </form>
      <p id="join-error" className="error">
        {joinError}
      </p>
    </section>
  );
}
