import { addMonths, addYears } from "date-fns";
import { headersFor, joinUrl, messageFrom } from "@/lib/calendar/http";
import { relayRequest } from "@/lib/calendar/relay";
import {
  asColor,
  type Calendar,
  type CalEvent,
  type Freq,
  type Recurrence,
  type Settings,
} from "@/lib/calendar/types";

const FREQS = new Set<Freq>(["daily", "weekly", "monthly", "yearly"]);

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asList(data: unknown, keys: string[]): unknown[] {
  if (Array.isArray(data)) return data;
  const record = asRecord(data);
  if (!record) return [];
  for (const key of keys) {
    if (Array.isArray(record[key])) return record[key] as unknown[];
  }
  for (const key of keys) {
    const one = record[key.endsWith("s") ? key.slice(0, -1) : key];
    if (one && typeof one === "object") return [one];
  }
  return [];
}

function readStamp(value: unknown, allDay: boolean): string | null {
  if (typeof value === "string" && value.trim()) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
    if (/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
      const [y, m, d] = value.trim().split("-").map(Number);
      return new Date(y, m - 1, d, allDay ? 0 : 9, 0, 0, 0).toISOString();
    }
  }
  const record = asRecord(value);
  if (!record) return null;
  if (typeof record.dateTime === "string") return readStamp(record.dateTime, false);
  if (typeof record.date === "string") return readStamp(record.date, true);
  return null;
}

function readRecurrence(value: unknown): Recurrence | null {
  if (!value) return null;
  if (typeof value === "string") {
    const freq = value.match(/FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)/i)?.[1]?.toLowerCase() as
      | Freq
      | undefined;
    if (!freq || !FREQS.has(freq)) return null;
    const interval = Number(value.match(/INTERVAL=(\d+)/i)?.[1] ?? 1);
    const untilRaw = value.match(/UNTIL=(\d{8})/i)?.[1];
    const until = untilRaw
      ? `${untilRaw.slice(0, 4)}-${untilRaw.slice(4, 6)}-${untilRaw.slice(6, 8)}`
      : undefined;
    return { freq, interval: Number.isFinite(interval) && interval > 0 ? interval : 1, until };
  }
  const record = asRecord(value);
  if (!record) return null;
  const freq = String(record.freq ?? record.frequency ?? "").toLowerCase() as Freq;
  if (!FREQS.has(freq)) return null;
  const interval = Number(record.interval ?? 1);
  const untilValue = record.until ?? record.untilDate;
  const until =
    typeof untilValue === "string" && untilValue.trim()
      ? untilValue.trim().slice(0, 10)
      : undefined;
  return { freq, interval: Number.isFinite(interval) && interval > 0 ? interval : 1, until };
}

export function normalizeCalendar(value: unknown): Calendar | null {
  const record = asRecord(value);
  if (!record) return null;
  const id = record.id ?? record.calendarId;
  if (id === undefined || id === null || String(id).trim() === "") return null;
  const name = String(record.name ?? record.summary ?? record.title ?? "Calendar").trim();
  return { id: String(id), name: name || "Calendar", color: asColor(record.color) };
}

export function normalizeEvent(value: unknown): CalEvent | null {
  const record = asRecord(value);
  if (!record) return null;
  const id = record.id ?? record.eventId;
  if (id === undefined || id === null || String(id).trim() === "") return null;
  const allDay = Boolean(record.allDay ?? record.all_day ?? asRecord(record.start)?.date);
  const start = readStamp(record.start ?? record.startTime ?? record.startsAt, allDay);
  const end = readStamp(record.end ?? record.endTime ?? record.endsAt, allDay);
  if (!start || !end) return null;
  const calendarId = record.calendarId ?? record.calendar_id ?? record.calendar;
  return {
    id: String(id),
    calendarId: calendarId === undefined || calendarId === null ? "" : String(calendarId),
    title: String(record.title ?? record.summary ?? record.name ?? "(No title)").trim() || "(No title)",
    description: String(record.description ?? record.notes ?? ""),
    location: String(record.location ?? ""),
    start,
    end,
    allDay,
    recurrence: readRecurrence(record.recurrence ?? record.rrule),
  };
}

export function normalizeCalendars(data: unknown): Calendar[] {
  return asList(data, ["calendars", "items", "data"])
    .map(normalizeCalendar)
    .filter((item): item is Calendar => item !== null);
}

export function normalizeEvents(data: unknown): CalEvent[] {
  return asList(data, ["events", "items", "data"])
    .map(normalizeEvent)
    .filter((item): item is CalEvent => item !== null);
}

function unwrapOne(data: unknown, keys: string[]): unknown {
  const record = asRecord(data);
  if (!record) return data;
  for (const key of keys) {
    const value = record[key];
    if (value && typeof value === "object" && !Array.isArray(value)) return value;
  }
  return data;
}

export function eventPayload(event: CalEvent): CalEvent {
  return {
    id: event.id,
    calendarId: event.calendarId,
    title: event.title,
    description: event.description,
    location: event.location,
    start: event.start,
    end: event.end,
    allDay: event.allDay,
    recurrence: event.recurrence,
  };
}

async function call(
  settings: Settings,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
): Promise<unknown> {
  const baseUrl = settings.baseUrl.trim();
  if (!baseUrl) throw new Error("Add your API base URL first.");
  try {
    const probe = new URL(joinUrl(baseUrl, path));
    if (probe.protocol !== "http:" && probe.protocol !== "https:") {
      throw new Error("Enter a full URL, including https://.");
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("https://")) throw error;
    throw new Error("Enter a full URL, including https://.");
  }

  if (settings.transport === "relay") {
    const result = await relayRequest({
      data: {
        baseUrl,
        path,
        method,
        auth: settings.auth,
        token: settings.token,
        apiKeyHeader: settings.apiKeyHeader || "X-Api-Key",
        body,
      },
    });
    if (!result.ok) throw new Error(result.error);
    return JSON.parse(result.json) as unknown;
  }

  let response: Response;
  try {
    response = await fetch(joinUrl(baseUrl, path), {
      method,
      headers: headersFor(settings, body !== undefined),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error(
      "This device could not reach your server. If the browser blocked the request, switch transport to Relay.",
    );
  }
  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text.slice(0, 280);
    }
  }
  if (!response.ok) throw new Error(messageFrom(data, response.status));
  return data;
}

export async function testConnection(settings: Settings): Promise<string> {
  const data = await call(settings, "GET", "/calendars");
  const calendars = normalizeCalendars(data);
  const noun = calendars.length === 1 ? "calendar" : "calendars";
  return `Connected. ${calendars.length} ${noun} on the server.`;
}

export async function downloadSchedule(settings: Settings): Promise<{
  calendars: Calendar[];
  events: CalEvent[];
}> {
  const now = new Date();
  const from = addMonths(now, -6).toISOString();
  const to = addYears(now, 2).toISOString();
  const [calendarData, eventData] = await Promise.all([
    call(settings, "GET", "/calendars"),
    call(settings, "GET", `/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  ]);
  return {
    calendars: normalizeCalendars(calendarData),
    events: normalizeEvents(eventData),
  };
}

export async function saveCalendar(
  settings: Settings,
  calendar: Calendar,
  isNew: boolean,
): Promise<Calendar> {
  const data = await call(
    settings,
    isNew ? "POST" : "PATCH",
    isNew ? "/calendars" : `/calendars/${encodeURIComponent(calendar.id)}`,
    { id: calendar.id, name: calendar.name, color: calendar.color },
  );
  return normalizeCalendar(unwrapOne(data, ["calendar", "item", "data"])) ?? calendar;
}

export async function deleteCalendar(settings: Settings, id: string): Promise<void> {
  await call(settings, "DELETE", `/calendars/${encodeURIComponent(id)}`);
}

export async function saveEvent(
  settings: Settings,
  event: CalEvent,
  isNew: boolean,
): Promise<CalEvent> {
  const data = await call(
    settings,
    isNew ? "POST" : "PATCH",
    isNew ? "/events" : `/events/${encodeURIComponent(event.id)}`,
    eventPayload(event),
  );
  return normalizeEvent(unwrapOne(data, ["event", "item", "data"])) ?? event;
}

export async function deleteEvent(settings: Settings, id: string): Promise<void> {
  await call(settings, "DELETE", `/events/${encodeURIComponent(id)}`);
}
