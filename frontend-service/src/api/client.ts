import { getSessionAccessToken } from "../auth/session";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(
  /\/$/,
  "",
);

export function apiUrl(path: string) {
  return `${API_BASE_URL}${path}`;
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
  accessToken?: string,
): Promise<T> {
  const headers = new Headers(options.headers);
  const token = accessToken ?? getSessionAccessToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(apiUrl(path), { ...options, headers });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      message = body.message || body.error || message;
    } catch {
      // Response was not JSON; keep default message.
    }
    throw new Error(message);
  }
  if (res.status === 204) {
    return null as T;
  }
  const contentType = res.headers.get("content-type") || "";
  return contentType.includes("application/json") ? res.json() : (null as T);
}

export async function apiBlob(
  path: string,
  options: RequestInit = {},
  accessToken?: string,
): Promise<Blob> {
  const headers = new Headers(options.headers);
  const token = accessToken ?? getSessionAccessToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(apiUrl(path), { ...options, headers });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      message = body.message || body.error || message;
    } catch {
      // Response was not JSON; keep default message.
    }
    throw new Error(message);
  }
  return res.blob();
}

export function authorizationHeaders(
  accessToken?: string,
): Record<string, string> {
  const token = accessToken ?? getSessionAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
