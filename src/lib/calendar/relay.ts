import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authHeaders, joinUrl, messageFrom } from "@/lib/calendar/http";

const relaySchema = z.object({
  baseUrl: z.string().trim().min(1).max(500),
  path: z.string().trim().min(1).max(400),
  method: z.enum(["GET", "POST", "PATCH", "DELETE"]),
  auth: z.enum(["none", "bearer", "api-key", "basic"]),
  token: z.string().max(4000).optional().default(""),
  apiKeyHeader: z.string().max(80).optional().default("X-Api-Key"),
  body: z.unknown().optional(),
});

export type RelayInput = z.infer<typeof relaySchema>;

export type RelayResult =
  | { ok: true; status: number; json: string }
  | { ok: false; status: number; error: string };

const BANNED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "169.254.169.254",
  "metadata.google.internal",
]);

export const relayRequest = createServerFn({ method: "POST" })
  .validator((input: unknown): RelayInput => relaySchema.parse(input))
  .handler(async ({ data }): Promise<RelayResult> => {
    try {
      const path = data.path;
      if (!path.startsWith("/") || path.includes("..") || path.includes("://")) {
        return { ok: false, status: 400, error: "That API path is not allowed." };
      }
      if (!/^\/[A-Za-z0-9._~!$&'()*+,;=:@/?%-]*$/.test(path)) {
        return { ok: false, status: 400, error: "That API path is not allowed." };
      }
      let url: URL;
      try {
        url = new URL(joinUrl(data.baseUrl, path));
      } catch {
        return { ok: false, status: 400, error: "Enter a full URL, including https://." };
      }
      if (url.protocol !== "https:" && url.protocol !== "http:") {
        return { ok: false, status: 400, error: "Only http and https servers are supported." };
      }
      if (url.username || url.password) {
        return {
          ok: false,
          status: 400,
          error: "Remove the username and password from the URL. Use the token field.",
        };
      }
      const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
      if (BANNED_HOSTS.has(host)) {
        return {
          ok: false,
          status: 400,
          error:
            "Relay cannot call localhost. Use Direct so this device talks to a server on your own machine.",
        };
      }
      const headers = authHeaders(data.auth, data.token, data.apiKeyHeader || "X-Api-Key");
      if (data.body !== undefined) headers["Content-Type"] = "application/json";
      const response = await fetch(url, {
        method: data.method,
        headers,
        body: data.body !== undefined ? JSON.stringify(data.body) : undefined,
        signal: AbortSignal.timeout(12_000),
        redirect: "follow",
      });
      const text = await response.text();
      if (text.length > 2_000_000) {
        return { ok: false, status: 502, error: "The server response was too large." };
      }
      if (!response.ok) {
        let parsed: unknown = text.slice(0, 280);
        if (text) {
          try {
            parsed = JSON.parse(text);
          } catch {
            parsed = text.slice(0, 280);
          }
        }
        return { ok: false, status: response.status, error: messageFrom(parsed, response.status) };
      }
      if (!text) return { ok: true, status: response.status, json: "null" };
      try {
        JSON.parse(text);
        return { ok: true, status: response.status, json: text };
      } catch {
        return {
          ok: true,
          status: response.status,
          json: JSON.stringify({ message: text.slice(0, 280) }),
        };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not reach your server.";
      return { ok: false, status: 0, error: message };
    }
  });
