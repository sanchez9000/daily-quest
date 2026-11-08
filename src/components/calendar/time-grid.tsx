import { useEffect, useRef, useState } from "react";
import { addMinutes, differenceInMinutes, format, isToday, startOfDay } from "date-fns";
import clsx from "clsx";
import {
  allDaySegments,
  clipToDay,
  expandEvents,
  layoutTimed,
  parseStamp,
  timedOnDay,
  type Occurrence,
} from "@/lib/calendar/occur";
import { tone, type Calendar, type CalEvent } from "@/lib/calendar/types";

export const HOUR_PX = 64;

export function DayStrip({
  days,
  anchor,
  onPick,
}: {
  days: Date[];
  anchor: Date;
  onPick: (day: Date) => void;
}) {
  return (
    <div className="grid shrink-0 grid-cols-7 border-b border-line">
      {days.map((day) => {
        const selected = format(day, "yyyy-MM-dd") === format(anchor, "yyyy-MM-dd");
        const today = isToday(day);
        return (
          <button
            key={day.toISOString()}
            type="button"
            onClick={() => onPick(day)}
            className="flex min-h-14 flex-col items-center justify-center gap-1"
          >
            <span className="text-xs text-faint">{format(day, "EEEEE")}</span>
            <span
              className={clsx(
                "grid size-8 place-items-center rounded-full text-sm tabular-nums",
                selected && "bg-accent font-semibold text-accent-fg",
                !selected && today && "text-accent",
              )}
            >
              {format(day, "d")}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function TimeGrid({
  days,
  calendars,
  events,
  hiddenIds,
  onCreate,
  onCreateAllDay,
  onOpen,
  onOpenDay,
}: {
  days: Date[];
  calendars: Calendar[];
  events: CalEvent[];
  hiddenIds: string[];
  onCreate: (start: Date) => void;
  onCreateAllDay: (day: Date) => void;
  onOpen: (event: CalEvent) => void;
  onOpenDay: (day: Date) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => new Date());
  const rangeStart = startOfDay(days[0] ?? new Date());
  const rangeEnd = startOfDay(days[days.length - 1] ?? rangeStart);
  rangeEnd.setDate(rangeEnd.getDate() + 1);
  const visible = expandEvents(events, hiddenIds, rangeStart, rangeEnd);
  const bars = allDaySegments(visible, days);
  const byId = new Map(calendars.map((calendar) => [calendar.id, calendar]));
  const cols = Math.max(days.length, 1);

  useEffect(() => {
    const node = scroller.current;
    if (!node) return;
    node.scrollTop = 7 * HOUR_PX;
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const showNow = days.some((day) => isToday(day));
  const nowTop = (differenceInMinutes(now, startOfDay(now)) / 60) * HOUR_PX;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        className="grid shrink-0 border-b border-line"
        style={{ gridTemplateColumns: `3.25rem repeat(${cols}, minmax(0, 1fr))` }}
      >
        <div />
        {days.map((day) => (
          <button
            key={day.toISOString()}
            type="button"
            onClick={() => onOpenDay(day)}
            className="flex min-h-12 flex-col items-center justify-center border-l border-line py-1"
          >
            <span className="text-xs text-faint">{format(day, "EEE")}</span>
            <span
              className={clsx(
                "grid size-8 place-items-center rounded-full text-sm font-semibold tabular-nums",
                isToday(day) && "bg-accent text-accent-fg",
              )}
            >
              {format(day, "d")}
            </span>
          </button>
        ))}
      </div>
      <div
        className="grid shrink-0 border-b border-line"
        style={{ gridTemplateColumns: "3.25rem minmax(0, 1fr)" }}
      >
        <div className="px-1 py-2 text-right text-xs leading-tight text-faint">all day</div>
        <div className="relative border-l border-line">
          <div
            className="absolute inset-0 grid"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
          >
            {days.map((day) => (
              <button
                key={day.toISOString()}
                type="button"
                aria-label={`Add all-day event on ${format(day, "MMMM d")}`}
                className="hover:bg-raised"
                onClick={() => onCreateAllDay(day)}
              />
            ))}
          </div>
          <div
            className="pointer-events-none relative grid min-h-10 gap-y-0.5 p-1"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
          >
            {bars.map((bar) => {
              const colors = tone(byId.get(bar.event.calendarId)?.color);
              return (
                <button
                  key={bar.event.key}
                  type="button"
                  style={{
                    gridColumn: `${bar.col + 1} / span ${bar.span}`,
                    gridRow: bar.lane + 1,
                  }}
                  onClick={() => onOpen(masterOf(events, bar.event))}
                  className={clsx(
                    "pointer-events-auto h-6 truncate rounded px-1.5 text-left text-xs font-medium",
                    colors.chip,
                  )}
                >
                  {bar.event.title}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
        <div
          className="relative grid"
          style={{ gridTemplateColumns: `3.25rem repeat(${cols}, minmax(0, 1fr))` }}
        >
          <div>
            {Array.from({ length: 24 }).map((_, hour) => (
              <div key={hour} className="relative h-16 border-b border-line/70">
                {hour !== 0 ? (
                  <span className="absolute -top-2 right-1 text-xs text-faint tabular-nums">
                    <span className="md:hidden">{shortHour(hour)}</span>
                    <span className="hidden md:inline">{longHour(hour)}</span>
                  </span>
                ) : null}
              </div>
            ))}
          </div>
          {days.map((day) => (
            <DayColumn
              key={day.toISOString()}
              day={day}
              events={timedOnDay(visible, day)}
              calendars={byId}
              masters={events}
              onCreate={onCreate}
              onOpen={onOpen}
            />
          ))}
          {showNow ? (
            <div
              className="pointer-events-none absolute right-0 z-20"
              style={{ top: nowTop, left: "3.25rem" }}
            >
              <span className="absolute -top-1 -left-1.5 size-2.5 rounded-full bg-cal-tomato" />
              <span className="block h-px bg-cal-tomato" />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DayColumn({
  day,
  events,
  calendars,
  masters,
  onCreate,
  onOpen,
}: {
  day: Date;
  events: Occurrence[];
  calendars: Map<string, Calendar>;
  masters: CalEvent[];
  onCreate: (start: Date) => void;
  onOpen: (event: CalEvent) => void;
}) {
  const laid = layoutTimed(events);
  return (
    <div
      className={clsx(
        "relative border-l border-line",
        isToday(day) && "bg-accent/5",
      )}
      onClick={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        const y = event.clientY - bounds.top + 0;
        const minutes = Math.max(0, Math.min(24 * 60 - 15, Math.floor((y / HOUR_PX) * 60 / 15) * 15));
        onCreate(addMinutes(startOfDay(day), minutes));
      }}
    >
      {Array.from({ length: 24 }).map((_, hour) => (
        <div key={hour} className="h-16 border-b border-line/70" />
      ))}
      {laid.map(({ event, col, cols }) => {
        const clip = clipToDay(event, day);
        if (!clip) return null;
        const top = (differenceInMinutes(clip.start, startOfDay(day)) / 60) * HOUR_PX;
        const height = Math.max(
          (differenceInMinutes(clip.end, clip.start) / 60) * HOUR_PX,
          22,
        );
        const colors = tone(calendars.get(event.calendarId)?.color);
        return (
          <button
            key={event.key}
            type="button"
            onClick={(click) => {
              click.stopPropagation();
              onOpen(masterOf(masters, event));
            }}
            className={clsx(
              "absolute overflow-hidden rounded border-l-4 px-1.5 py-0.5 text-left",
              colors.block,
            )}
            style={{
              top,
              height,
              left: `calc(${(col / cols) * 100}% + 2px)`,
              width: `calc(${100 / cols}% - 4px)`,
              zIndex: col + 1,
            }}
          >
            <span className="block truncate text-xs font-semibold text-fg">{event.title}</span>
            {height > 32 ? (
              <span className="block truncate text-xs text-muted tabular-nums">
                {format(parseStamp(event.start), "h:mm a")}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function masterOf(events: CalEvent[], occurrence: CalEvent): CalEvent {
  return events.find((event) => event.id === occurrence.id) ?? occurrence;
}

function shortHour(hour: number): string {
  const suffix = hour < 12 ? "a" : "p";
  const h = hour % 12 || 12;
  return `${h}${suffix}`;
}

function longHour(hour: number): string {
  const suffix = hour < 12 ? "AM" : "PM";
  const h = hour % 12 || 12;
  return `${h} ${suffix}`;
}
