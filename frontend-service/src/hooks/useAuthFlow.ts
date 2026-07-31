import { useEffect, useState } from "react";
import type { User } from "oidc-client-ts";
import { api } from "../api/client";
import {
  beginOidcSignIn,
  endOidcSession,
  initializeOidc,
  oidcEnabled,
  onOidcUserLoaded,
} from "../auth/oidc";
import { loadSession, saveSession } from "../auth/session";
import type { ApiUser, FlowIntent, SessionUser } from "../types";

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
  const [authError, setAuthError] = useState("");
  const [isAuthLoading, setIsAuthLoading] = useState(oidcEnabled);

  useEffect(() => {
    saveSession(currentUser);
  }, [currentUser]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrapOidcUser(
      oidcUser: User,
      nextIntent: FlowIntent,
      navigate: boolean,
    ) {
      if (oidcUser.expired || !oidcUser.access_token || !oidcUser.id_token) {
        throw new Error("Zitadel session expired. Sign in again.");
      }

      const user = await api<ApiUser>(
        "/auth/profile",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        },
        oidcUser.access_token,
      );
      if (cancelled) return;

      const nextUser: SessionUser = {
        id: user.id,
        username: user.username,
        displayName: user.display_name || user.username,
        token: oidcUser.access_token,
        idToken: oidcUser.id_token,
        expiresAt: oidcUser.expires_at,
      };
      saveSession(nextUser);
      setCurrentUser(nextUser);
      if (navigate) {
        await onAuthenticated(nextIntent);
      }
    }

    let removeLoadedHandler = () => {};

    if (!oidcEnabled) {
      setIsAuthLoading(false);
      return;
    }

    void initializeOidc()
      .then(async ({ user, intent: restoredIntent }) => {
        if (cancelled) return;
        if (user) {
          await bootstrapOidcUser(user, restoredIntent, true);
        } else if (loadSession()) {
          saveSession(null);
          setCurrentUser(null);
        }
        if (!cancelled) {
          removeLoadedHandler = onOidcUserLoaded((loadedUser) => {
            void bootstrapOidcUser(loadedUser, null, false).catch((err) => {
              if (!cancelled) {
                setAuthError(
                  err instanceof Error
                    ? err.message
                    : "Session refresh failed",
                );
              }
            });
          });
        }
      })
      .catch((err) => {
        if (!cancelled) {
          saveSession(null);
          setCurrentUser(null);
          setAuthError(
            err instanceof Error ? err.message : "Zitadel sign-in failed",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsAuthLoading(false);
      });

    return () => {
      cancelled = true;
      removeLoadedHandler();
    };
  }, []);

  async function startOidcSignIn() {
    setAuthError("");
    setIsAuthLoading(true);
    try {
      await beginOidcSignIn(intent);
    } catch (err) {
      setIsAuthLoading(false);
      setAuthError(
        err instanceof Error ? err.message : "Zitadel sign-in failed",
      );
    }
  }

  async function logout() {
    const previousUser = currentUser;
    saveSession(null);
    setCurrentUser(null);
    onLogout();
    if (previousUser) {
      try {
        await endOidcSession(previousUser.idToken);
      } catch (err) {
        setAuthError(
          err instanceof Error ? err.message : "Zitadel logout failed",
        );
      }
    }
  }

  return {
    currentUser,
    authError,
    isAuthLoading,
    oidcEnabled,
    logout,
    startOidcSignIn,
  };
}
