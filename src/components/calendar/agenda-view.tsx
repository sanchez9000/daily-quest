import { addDays, eachDayOfInterval, format, isToday, startOfDay } from "date-fns";
import clsx from "clsx";
import { MapPin } from "lucide-react";
import { coversDay, expandEvents, parseStamp } from "@/lib/calendar/occur";
import { tone, type Calendar, type CalEvent } from "@/lib/calendar/types";

export function AgendaView({
  anchor,
  calendars,
  events,
  hiddenIds,
  onOpen,
  onCreate,
}: {
  anchor: Date;
  calendars: Calendar[];
  events: CalEvent[];
  hiddenIds: string[];
  onOpen: (event: CalEvent) => void;
  onCreate: (day: Date) => void;
}) {
  const start = startOfDay(anchor);
  const end = addDays(start, 42);
  const visible = expandEvents(events, hiddenIds, start, end);
  const byId = new Map(calendars.map((calendar) => [calendar.id, calendar]));
  const groups = eachDayOfInterval({ start, end: addDays(start, 41) })
    .map((day) => ({
      day,
      events: visible
        .filter((event) => coversDay(event, day))
        .sort((a, b) => {
          if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
          return parseStamp(a.start).getTime() - parseStamp(b.start).getTime();
        }),
    }))
    .filter((group) => group.events.length > 0);

  if (!groups.length) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-lg font-semibold">Nothing scheduled</p>
        <p className="max-w-sm text-sm text-pretty text-muted">
          The next six weeks are open. Create an event, or turn a hidden calendar back on.
        </p>
        <button
          type="button"
          onClick={() => onCreate(start)}
          className="h-11 rounded-full bg-accent px-5 text-sm font-semibold text-accent-fg"
        >
          Create event
        </button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <ul className="mx-auto max-w-3xl pb-24">
        {groups.map((group) => (
          <li key={group.day.toISOString()} className="border-b border-line">
            <div className="flex gap-3 px-4 py-3 md:px-6">
              <div className="w-14 shrink-0 pt-1 text-center">
                <p className="text-xs font-medium text-faint uppercase">{format(group.day, "EEE")}</p>
                <p
                  className={clsx(
                    "mx-auto mt-1 grid size-9 place-items-center rounded-full text-lg font-semibold tabular-nums",
                    isToday(group.day) && "bg-accent text-accent-fg",
                  )}
                >
                  {format(group.day, "d")}
                </p>
              </div>
              <ul className="min-w-0 flex-1 space-y-1">
                {group.events.map((event) => {
                  const colors = tone(byId.get(event.calendarId)?.color);
                  const master = events.find((item) => item.id === event.id) ?? event;
                  return (
                    <li key={event.key}>
                      <button
                        type="button"
                        onClick={() => onOpen(master)}
                        className="flex min-h-11 w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-raised"
                      >
                        <span className={clsx("mt-1 size-2.5 shrink-0 rounded-full", colors.dot)} />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{event.title}</span>
                          <span className="block truncate text-xs text-muted tabular-nums">
                            {event.allDay
                              ? "All day"
                              : `${format(parseStamp(event.start), "h:mm a")} – ${format(parseStamp(event.end), "h:mm a")}`}
                            {event.location ? ` · ${event.location}` : ""}
                          </span>
                        </span>
                        {event.location ? <MapPin className="mt-1 size-3.5 shrink-0 text-faint" /> : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
