import type { ApiAuth, Settings } from "@/lib/calendar/types";

export function joinUrl(base: string, path: string): string {
  const b = base.trim().replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return b + p;
}

export function authHeaders(
  auth: ApiAuth,
  token: string,
  apiKeyHeader: string,
): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const secret = token.trim();
  if (auth === "none" || !secret) return headers;
  if (/[\r\n]/.test(secret)) throw new Error("The token cannot contain line breaks.");
  if (auth === "bearer") headers.Authorization = `Bearer ${secret}`;
  if (auth === "basic") headers.Authorization = `Basic ${encodeBasic(secret)}`;
  if (auth === "api-key") {
    if (!/^[A-Za-z0-9-]{1,80}$/.test(apiKeyHeader)) {
      throw new Error("API key header name looks invalid.");
    }
    headers[apiKeyHeader] = secret;
  }
  return headers;
}

export function headersFor(settings: Settings, withBody: boolean): Record<string, string> {
  const headers = authHeaders(settings.auth, settings.token, settings.apiKeyHeader || "X-Api-Key");
  if (withBody) headers["Content-Type"] = "application/json";
  return headers;
}

function encodeBasic(token: string): string {
  const bytes = new TextEncoder().encode(token);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function messageFrom(data: unknown, status: number): string {
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    if (typeof o.error === "string" && o.error.trim()) return o.error.trim();
    if (typeof o.message === "string" && o.message.trim()) return o.message.trim();
  }
  if (typeof data === "string" && data.trim()) return data.trim().slice(0, 280);
  return `The server replied with ${status}.`;
}
