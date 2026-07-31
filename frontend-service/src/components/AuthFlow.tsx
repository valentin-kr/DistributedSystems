import { ArrowLeft, LogIn, ShieldCheck } from "lucide-react";

type AuthFlowProps = {
  hidden: boolean;
  authError: string;
  isAuthLoading: boolean;
  oidcEnabled: boolean;
  onBack: () => void;
  onSignIn: () => void;
};

export function AuthFlow({
  hidden,
  authError,
  isAuthLoading,
  oidcEnabled,
  onBack,
  onSignIn,
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
          <h2>Sign in to TimeChat</h2>
          <p>Use your email and password on the secure sign-in page.</p>
        </div>
      </div>

      {oidcEnabled ? (
        <div className="oidc-actions">
          <button type="button" onClick={onSignIn} disabled={isAuthLoading}>
            <LogIn size={18} aria-hidden="true" />
            {isAuthLoading ? "Connecting..." : "Sign in with email"}
          </button>
        </div>
      ) : null}

      {!oidcEnabled ? (
        <p className="error">Authentication is not configured.</p>
      ) : null}
      <p id="auth-error" className="error">
        {authError}
      </p>
    </section>
  );
}
