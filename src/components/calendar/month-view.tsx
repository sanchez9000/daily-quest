import { format, isSameMonth, isToday } from "date-fns";
import clsx from "clsx";
import { Repeat } from "lucide-react";
import {
  allDaySegments,
  expandEvents,
  monthGrid,
  parseStamp,
  timedOnDay,
} from "@/lib/calendar/occur";
import { tone, type Calendar, type CalEvent } from "@/lib/calendar/types";

const TIMED_CAP = 3;

export function MonthView({
  anchor,
  weekStartsOn,
  calendars,
  events,
  hiddenIds,
  onCreate,
  onOpen,
  onOpenDay,
}: {
  anchor: Date;
  weekStartsOn: 0 | 1;
  calendars: Calendar[];
  events: CalEvent[];
  hiddenIds: string[];
  onCreate: (day: Date) => void;
  onOpen: (event: CalEvent) => void;
  onOpenDay: (day: Date) => void;
}) {
  const weeks = monthGrid(anchor, weekStartsOn);
  const rangeStart = weeks[0]?.[0] ?? anchor;
  const rangeEnd = new Date((weeks[weeks.length - 1]?.[6] ?? anchor).getTime());
  rangeEnd.setDate(rangeEnd.getDate() + 1);
  const visible = expandEvents(events, hiddenIds, rangeStart, rangeEnd);
  const byId = new Map(calendars.map((calendar) => [calendar.id, calendar]));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="grid shrink-0 grid-cols-7 border-b border-line">
        {(weeks[0] ?? []).map((day) => (
          <div key={format(day, "EEE")} className="px-1 py-2 text-center text-xs font-medium text-faint">
            <span className="md:hidden">{format(day, "EEEEE")}</span>
            <span className="hidden md:inline">{format(day, "EEE")}</span>
          </div>
        ))}
      </div>
      <div
        className="grid min-h-0 flex-1"
        style={{ gridTemplateRows: `repeat(${Math.max(weeks.length, 1)}, minmax(0, 1fr))` }}
      >
        {weeks.map((week) => {
          const bars = allDaySegments(visible, week);
          return (
            <div key={week[0]?.toISOString()} className="relative grid min-h-0 grid-cols-7">
              {week.map((day, index) => {
                const timed = timedOnDay(visible, day);
                const lanesHere = bars.filter(
                  (bar) => index >= bar.col && index < bar.col + bar.span,
                );
                const spacer = lanesHere.length
                  ? Math.max(...lanesHere.map((bar) => bar.lane)) + 1
                  : 0;
                const shown = timed.slice(0, TIMED_CAP);
                const extra = timed.length - shown.length;
                const outside = !isSameMonth(day, anchor);
                return (
                  <div
                    key={day.toISOString()}
                    className={clsx(
                      "flex min-h-0 min-w-0 flex-col border-r border-b border-line",
                      outside && "bg-ink/40",
                    )}
                    onClick={() => onCreate(day)}
                  >
                    <div className="flex h-7 shrink-0 justify-end px-1 pt-1">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpenDay(day);
                        }}
                        className={clsx(
                          "grid size-6 place-items-center rounded-full text-xs tabular-nums",
                          isToday(day) && "bg-accent font-semibold text-accent-fg",
                          !isToday(day) && outside && "text-faint",
                          !isToday(day) && !outside && "text-fg hover:bg-raised",
                        )}
                      >
                        {format(day, "d")}
                      </button>
                    </div>
                    <div className="flex min-h-0 flex-col gap-0.5 overflow-hidden px-0.5 pb-1 md:px-1">
                      {Array.from({ length: spacer }).map((_, lane) => (
                        <div key={lane} className="h-5 shrink-0" />
                      ))}
                      {shown.map((event) => {
                        const colors = tone(byId.get(event.calendarId)?.color);
                        return (
                          <button
                            key={event.key}
                            type="button"
                            onClick={(click) => {
                              click.stopPropagation();
                              onOpen(masterOf(events, event));
                            }}
                            className={clsx(
                              "flex h-5 shrink-0 items-center gap-1 truncate rounded px-1 text-left text-xs font-medium",
                              colors.chip,
                            )}
                            title={event.title}
                          >
                            <span className="truncate">
                              <span className="mr-1 hidden tabular-nums opacity-80 sm:inline">
                                {format(parseStamp(event.start), "h:mm a")}
                              </span>
                              {event.title}
                            </span>
                            {event.recurrence ? <Repeat className="size-3 shrink-0" /> : null}
                          </button>
                        );
                      })}
                      {extra > 0 ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onOpenDay(day);
                          }}
                          className="h-5 shrink-0 truncate px-1 text-left text-xs font-medium text-muted hover:text-fg"
                        >
                          +{extra} more
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
              <div className="pointer-events-none absolute inset-x-0 top-7 grid grid-cols-7 gap-y-0.5 px-0.5 md:px-1">
                {bars.map((bar) => {
                  const colors = tone(byId.get(bar.event.calendarId)?.color);
                  return (
                    <button
                      key={bar.event.key + bar.col}
                      type="button"
                      style={{
                        gridColumn: `${bar.col + 1} / span ${bar.span}`,
                        gridRow: bar.lane + 1,
                      }}
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpen(masterOf(events, bar.event));
                      }}
                      className={clsx(
                        "pointer-events-auto h-5 truncate rounded px-1 text-left text-xs font-medium",
                        colors.chip,
                      )}
                      title={bar.event.title}
                    >
                      {bar.event.title}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function masterOf(events: CalEvent[], occurrence: CalEvent): CalEvent {
  return events.find((event) => event.id === occurrence.id) ?? occurrence;
}
