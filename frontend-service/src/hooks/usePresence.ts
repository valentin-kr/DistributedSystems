import { useEffect } from "react";
import { api } from "../api/client";

const HEARTBEAT_INTERVAL_MS = 30_000;
const PRESENCE_REFRESH_INTERVAL_MS = 5_000;
const INTERACTION_HEARTBEAT_MIN_INTERVAL_MS = 10_000;
const ACTIVITY_REFRESH_DELAY_MS = 500;

type UsePresenceOptions = {
  active: boolean;
  roomId: number | null;
  userId?: number;
  refreshActivity: () => Promise<unknown>;
};

export function usePresence({
  active,
  roomId,
  userId,
  refreshActivity,
}: UsePresenceOptions) {
  useEffect(() => {
    if (!active || !roomId || !userId) return;

    let refreshTimer: number | undefined;
    let lastHeartbeatAt = 0;
    let heartbeatPending = false;

    function isChatWindowActive() {
      return document.visibilityState === "visible" && document.hasFocus();
    }

    async function sendHeartbeat(force = false) {
      const now = Date.now();
      if (
        !isChatWindowActive() ||
        heartbeatPending ||
        (!force &&
          now - lastHeartbeatAt < INTERACTION_HEARTBEAT_MIN_INTERVAL_MS)
      ) {
        return;
      }

      heartbeatPending = true;
      try {
        await api<void>(`/chatrooms/${roomId}/activity`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        });
        lastHeartbeatAt = Date.now();
        window.clearTimeout(refreshTimer);
        refreshTimer = window.setTimeout(() => {
          void refreshActivity().catch(() => {});
        }, ACTIVITY_REFRESH_DELAY_MS);
      } catch {
        // Presence is best effort and must not interrupt chat use.
      } finally {
        heartbeatPending = false;
      }
    }

    function handleWindowActive() {
      if (isChatWindowActive()) void sendHeartbeat(true);
    }

    function handleInteraction() {
      void sendHeartbeat();
    }

    void sendHeartbeat(true);
    const heartbeatTimer = window.setInterval(
      () => void sendHeartbeat(true),
      HEARTBEAT_INTERVAL_MS,
    );
    const presenceRefreshTimer = window.setInterval(() => {
      if (isChatWindowActive()) void refreshActivity().catch(() => {});
    }, PRESENCE_REFRESH_INTERVAL_MS);
    window.addEventListener("focus", handleWindowActive);
    window.addEventListener("pointerdown", handleInteraction);
    window.addEventListener("keydown", handleInteraction);
    document.addEventListener("visibilitychange", handleWindowActive);

    return () => {
      window.clearInterval(heartbeatTimer);
      window.clearInterval(presenceRefreshTimer);
      window.clearTimeout(refreshTimer);
      window.removeEventListener("focus", handleWindowActive);
      window.removeEventListener("pointerdown", handleInteraction);
      window.removeEventListener("keydown", handleInteraction);
      document.removeEventListener("visibilitychange", handleWindowActive);
    };
  }, [active, refreshActivity, roomId, userId]);
}
