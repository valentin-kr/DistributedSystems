import type { SyntheticEvent } from "react";
import { ArrowLeft, MessageSquareText, ShieldCheck } from "lucide-react";

type FormSubmitEvent = SyntheticEvent<HTMLFormElement>;

type AuthFlowProps = {
  hidden: boolean;
  phoneNumber: string;
  verifyCode: string;
  signupUsername: string;
  smsNote: string;
  authError: string;
  showVerifyForm: boolean;
  onBack: () => void;
  onRequestCode: (event: FormSubmitEvent) => void;
  onVerifyPhone: (event: FormSubmitEvent) => void;
  onPhoneNumberChange: (value: string) => void;
  onVerifyCodeChange: (value: string) => void;
  onSignupUsernameChange: (value: string) => void;
};

export function AuthFlow({
  hidden,
  phoneNumber,
  verifyCode,
  signupUsername,
  smsNote,
  authError,
  showVerifyForm,
  onBack,
  onRequestCode,
  onVerifyPhone,
  onPhoneNumberChange,
  onVerifyCodeChange,
  onSignupUsernameChange,
}: AuthFlowProps) {
  return (
    <section id="screen-auth" className="screen" hidden={hidden}>
      <button
        type="button"
        className="back-btn"
        id="auth-back-btn"
        onClick={onBack}
      >
        <ArrowLeft size={18} aria-hidden="true" />
        <span>Back</span>
      </button>
      <div className="screen-heading">
        <span className="screen-icon" aria-hidden="true">
          <ShieldCheck size={23} />
        </span>
        <div>
          <span className="eyebrow">Secure access</span>
          <h2>Verify your phone number</h2>
          <p>We use a one-time code to keep your conversations private.</p>
        </div>
      </div>
      <form id="request-code-form" onSubmit={onRequestCode}>
        <input
          id="phone-number"
          type="tel"
          placeholder="Phone number"
          required
          value={phoneNumber}
          onChange={(event) => onPhoneNumberChange(event.target.value)}
        />
        <button type="submit">
          <MessageSquareText size={18} aria-hidden="true" />
          Send code
        </button>
      </form>
      <form id="verify-form" hidden={!showVerifyForm} onSubmit={onVerifyPhone}>
        <input
          id="verify-code"
          placeholder="Verification code"
          required
          value={verifyCode}
          onChange={(event) => onVerifyCodeChange(event.target.value)}
        />
        <input
          id="signup-username"
          placeholder="Choose a username (first time only)"
          value={signupUsername}
          onChange={(event) => onSignupUsernameChange(event.target.value)}
        />
        <button type="submit">Verify &amp; continue</button>
      </form>
      <p id="simulated-sms-note" className="sms-note">
        {smsNote}
      </p>
      <p id="auth-error" className="error">
        {authError}
      </p>
    </section>
  );
}
