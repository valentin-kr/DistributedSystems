import {
  UserManager,
  WebStorageStateStore,
  type User,
} from "oidc-client-ts";
import type { FlowIntent } from "../types";

const issuer = (import.meta.env.VITE_ZITADEL_ISSUER ?? "").replace(/\/$/, "");
const clientId = import.meta.env.VITE_ZITADEL_CLIENT_ID ?? "";
const redirectUri =
  import.meta.env.VITE_ZITADEL_REDIRECT_URI ??
  `${window.location.origin}/oidc/callback`;
const postLogoutRedirectUri =
  import.meta.env.VITE_ZITADEL_POST_LOGOUT_REDIRECT_URI ??
  window.location.origin;

export const oidcEnabled = Boolean(issuer && clientId);

const manager = oidcEnabled
  ? new UserManager({
      authority: issuer,
      client_id: clientId,
      redirect_uri: redirectUri,
      post_logout_redirect_uri: postLogoutRedirectUri,
      response_type: "code",
      scope:
        import.meta.env.VITE_ZITADEL_SCOPES ??
        "openid profile email offline_access",
      automaticSilentRenew: true,
      userStore: new WebStorageStateStore({ store: window.sessionStorage }),
    })
  : null;

type OidcState = {
  intent?: FlowIntent;
};

export type OidcStartup = {
  user: User | null;
  intent: FlowIntent;
};

let startupPromise: Promise<OidcStartup> | null = null;

function callbackUrl() {
  return new URL(redirectUri, window.location.origin);
}

export function isOidcCallback() {
  if (!oidcEnabled) return false;
  const callback = callbackUrl();
  return (
    window.location.origin === callback.origin &&
    window.location.pathname === callback.pathname &&
    new URLSearchParams(window.location.search).has("state")
  );
}

export async function beginOidcSignIn(intent: FlowIntent) {
  if (!manager) {
    throw new Error("Zitadel is not configured");
  }
  await manager.signinRedirect({
    state: { intent } satisfies OidcState,
  });
}

export function initializeOidc(): Promise<OidcStartup> {
  if (!manager) {
    return Promise.resolve({ user: null, intent: null });
  }
  if (!startupPromise) {
    startupPromise = (async () => {
      if (isOidcCallback()) {
        const user = await manager.signinRedirectCallback();
        const state = (user.state ?? {}) as OidcState;
        window.history.replaceState({}, document.title, "/");
        return { user, intent: state.intent ?? null };
      }
      return { user: await manager.getUser(), intent: null };
    })();
  }
  return startupPromise;
}

export function onOidcUserLoaded(handler: (user: User) => void) {
  if (!manager) return () => {};
  manager.events.addUserLoaded(handler);
  return () => manager.events.removeUserLoaded(handler);
}

export async function endOidcSession(idToken?: string) {
  if (!manager) return;
  await manager.signoutRedirect({
    id_token_hint: idToken,
    post_logout_redirect_uri: postLogoutRedirectUri,
  });
}
