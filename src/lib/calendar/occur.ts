import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  differenceInMilliseconds,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  isSameDay,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import type { CalEvent, Recurrence } from "@/lib/calendar/types";

export type Occurrence = CalEvent & { key: string };

const GUARD = 800;

export function parseStamp(iso: string): Date {
  const d = parseISO(iso);
  return Number.isNaN(d.getTime()) ? new Date(iso) : d;
}

export function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function fromDayKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function atTime(day: Date, hours: number, minutes: number): Date {
  const d = startOfDay(day);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

function step(date: Date, recurrence: Recurrence): Date {
  const n = Math.max(1, Math.floor(recurrence.interval) || 1);
  if (recurrence.freq === "daily") return addDays(date, n);
  if (recurrence.freq === "weekly") return addWeeks(date, n);
  if (recurrence.freq === "monthly") return addMonths(date, n);
  return addYears(date, n);
}

function overlaps(start: Date, end: Date, rangeStart: Date, rangeEnd: Date): boolean {
  return start < rangeEnd && end > rangeStart;
}

export function expandEvent(event: CalEvent, rangeStart: Date, rangeEnd: Date): Occurrence[] {
  const masterStart = parseStamp(event.start);
  const masterEnd = parseStamp(event.end);
  if (Number.isNaN(masterStart.getTime()) || Number.isNaN(masterEnd.getTime())) return [];
  const duration = Math.max(differenceInMilliseconds(masterEnd, masterStart), event.allDay ? 86_400_000 : 60_000);
  if (!event.recurrence) {
    if (!overlaps(masterStart, masterEnd, rangeStart, rangeEnd)) return [];
    return [{ ...event, key: event.id }];
  }
  const until = event.recurrence.until
    ? addDays(fromDayKey(event.recurrence.until.slice(0, 10)), 1)
    : null;
  const out: Occurrence[] = [];
  let cursor = masterStart;
  for (let i = 0; i < GUARD && cursor < rangeEnd; i++) {
    if (until && cursor >= until) break;
    const end = new Date(cursor.getTime() + duration);
    if (overlaps(cursor, end, rangeStart, rangeEnd)) {
      out.push({
        ...event,
        start: cursor.toISOString(),
        end: end.toISOString(),
        key: `${event.id}@${cursor.toISOString()}`,
      });
    }
    const next = step(cursor, event.recurrence);
    if (next.getTime() <= cursor.getTime()) break;
    cursor = next;
  }
  return out;
}

export function expandEvents(
  events: CalEvent[],
  hiddenIds: string[],
  rangeStart: Date,
  rangeEnd: Date,
): Occurrence[] {
  const hidden = new Set(hiddenIds);
  return events
    .filter((event) => !hidden.has(event.calendarId))
    .flatMap((event) => expandEvent(event, rangeStart, rangeEnd))
    .sort((a, b) => parseStamp(a.start).getTime() - parseStamp(b.start).getTime());
}

export function monthGrid(anchor: Date, weekStartsOn: 0 | 1): Date[][] {
  const start = startOfWeek(startOfMonth(anchor), { weekStartsOn });
  const end = endOfWeek(endOfMonth(anchor), { weekStartsOn });
  const days = eachDayOfInterval({ start, end });
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return weeks;
}

export function weekDays(anchor: Date, weekStartsOn: 0 | 1): Date[] {
  const start = startOfWeek(anchor, { weekStartsOn });
  return eachDayOfInterval({ start, end: endOfWeek(anchor, { weekStartsOn }) });
}

export type Segment = { event: Occurrence; col: number; span: number; lane: number };

export function allDaySegments(events: Occurrence[], days: Date[]): Segment[] {
  const first = startOfDay(days[0] ?? new Date());
  const last = startOfDay(days[days.length - 1] ?? first);
  const segs: Omit<Segment, "lane">[] = [];
  for (const event of events) {
    if (!event.allDay) continue;
    const start = startOfDay(parseStamp(event.start));
    const exclusive = startOfDay(parseStamp(event.end));
    const lastDay = addDays(exclusive, exclusive.getTime() <= start.getTime() ? 0 : -1);
    if (lastDay < first || start > last) continue;
    let col = -1;
    let span = 0;
    days.forEach((day, index) => {
      const cursor = startOfDay(day);
      if (cursor >= start && cursor <= lastDay) {
        if (col === -1) col = index;
        span += 1;
      }
    });
    if (col >= 0 && span > 0) segs.push({ event, col, span });
  }
  segs.sort((a, b) => a.col - b.col || b.span - a.span);
  const laneEnds: number[] = [];
  return segs.map((seg) => {
    let lane = laneEnds.findIndex((end) => end < seg.col);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(seg.col + seg.span - 1);
    } else {
      laneEnds[lane] = seg.col + seg.span - 1;
    }
    return { ...seg, lane };
  });
}

export type LaidOut = { event: Occurrence; col: number; cols: number };

export function layoutTimed(events: Occurrence[]): LaidOut[] {
  const items = [...events].sort((a, b) => {
    const start = parseStamp(a.start).getTime() - parseStamp(b.start).getTime();
    if (start) return start;
    return parseStamp(b.end).getTime() - parseStamp(a.end).getTime();
  });
  const result: LaidOut[] = [];
  let cluster: Occurrence[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    if (!cluster.length) return;
    const colEnds: number[] = [];
    const assigned: { event: Occurrence; col: number }[] = [];
    for (const event of cluster) {
      const start = parseStamp(event.start).getTime();
      const end = parseStamp(event.end).getTime();
      let col = colEnds.findIndex((value) => value <= start);
      if (col === -1) {
        col = colEnds.length;
        colEnds.push(end);
      } else colEnds[col] = end;
      assigned.push({ event, col });
    }
    const cols = Math.max(colEnds.length, 1);
    for (const item of assigned) result.push({ event: item.event, col: item.col, cols });
    cluster = [];
    clusterEnd = -Infinity;
  };

  for (const event of items) {
    const start = parseStamp(event.start).getTime();
    const end = parseStamp(event.end).getTime();
    if (cluster.length && start >= clusterEnd) flush();
    cluster.push(event);
    clusterEnd = Math.max(clusterEnd, end);
  }
  flush();
  return result;
}

export function coversDay(event: Occurrence, day: Date): boolean {
  const start = startOfDay(day);
  const end = addDays(start, 1);
  return overlaps(parseStamp(event.start), parseStamp(event.end), start, end);
}

export function clipToDay(event: Occurrence, day: Date): { start: Date; end: Date } | null {
  const dayStart = startOfDay(day);
  const dayEnd = addDays(dayStart, 1);
  const start = parseStamp(event.start);
  const end = parseStamp(event.end);
  if (!overlaps(start, end, dayStart, dayEnd)) return null;
  return {
    start: start < dayStart ? dayStart : start,
    end: end > dayEnd ? dayEnd : end,
  };
}

export function sameDay(a: Date, b: Date): boolean {
  return isSameDay(a, b);
}

export function timedOnDay(events: Occurrence[], day: Date): Occurrence[] {
  return events.filter((event) => !event.allDay && coversDay(event, day));
}
