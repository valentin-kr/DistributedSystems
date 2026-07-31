import type { SessionUser } from "../types";

const SESSION_KEY = "timechat-user";
const EXPIRY_SKEW_SECONDS = 30;

export function loadSession(): SessionUser | null {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const user = JSON.parse(raw) as SessionUser;
    if (!user.token || !user.idToken) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    if (
      user.expiresAt &&
      user.expiresAt <= Date.now() / 1000 + EXPIRY_SKEW_SECONDS
    ) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return user;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function saveSession(user: SessionUser | null) {
  if (user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
}

export function getSessionAccessToken() {
  return loadSession()?.token;
}
