import { useEffect, useState } from "react";
import type { SyntheticEvent } from "react";
import { api } from "../api/client";
import { loadSession, saveSession } from "../auth/session";
import type { ApiUser, FlowIntent, SessionUser } from "../types";

type FormSubmitEvent = SyntheticEvent<HTMLFormElement>;

type UseAuthFlowOptions = {
  intent: FlowIntent;
  onAuthenticated: (intent: FlowIntent) => void | Promise<void>;
  onLogout: () => void;
};

export function useAuthFlow({
  intent,
  onAuthenticated,
  onLogout,
}: UseAuthFlowOptions) {
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(() =>
    loadSession(),
  );
  const [phoneNumber, setPhoneNumber] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [signupUsername, setSignupUsername] = useState("");
  const [smsNote, setSmsNote] = useState("");
  const [authError, setAuthError] = useState("");
  const [showVerifyForm, setShowVerifyForm] = useState(false);

  useEffect(() => {
    saveSession(currentUser);
  }, [currentUser]);

  async function requestCode(event: FormSubmitEvent) {
    event.preventDefault();
    setAuthError("");
    try {
      const result = await api<{ code: string }>("/auth/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber }),
      });
      setSmsNote(
        `Simulated SMS - your code is ${result.code} (a real deployment would text this to your phone instead)`,
      );
      setVerifyCode(result.code);
      setShowVerifyForm(true);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Auth request failed");
    }
  }

  async function verifyPhone(event: FormSubmitEvent) {
    event.preventDefault();
    setAuthError("");
    try {
      const user = await api<ApiUser & { token: string }>("/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber,
          code: verifyCode,
          username: signupUsername || undefined,
        }),
      });
      const nextUser: SessionUser = {
        id: user.id,
        username: user.username,
        phoneNumber: user.phone_number,
        token: user.token,
      };
      setCurrentUser(nextUser);
      await onAuthenticated(intent);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Verification failed");
    }
  }

  function logout() {
    setCurrentUser(null);
    onLogout();
  }

  return {
    currentUser,
    phoneNumber,
    verifyCode,
    signupUsername,
    smsNote,
    authError,
    showVerifyForm,
    requestCode,
    verifyPhone,
    logout,
    setPhoneNumber,
    setVerifyCode,
    setSignupUsername,
  };
}
