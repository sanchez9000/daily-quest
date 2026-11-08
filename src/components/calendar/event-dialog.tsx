import { useState } from "react";
import { addDays, format, startOfDay } from "date-fns";
import { fieldClass, Modal } from "@/components/calendar/modal";
import { parseStamp } from "@/lib/calendar/occur";
import { tone, type Calendar, type CalEvent, type Freq, type Recurrence } from "@/lib/calendar/types";

export type EditorState =
  | { kind: "new"; start: Date; end: Date; allDay: boolean }
  | { kind: "edit"; event: CalEvent };

const FREQS: { id: Freq | "none"; label: string }[] = [
  { id: "none", label: "Does not repeat" },
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
  { id: "yearly", label: "Yearly" },
];

function dateValue(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function timeValue(date: Date): string {
  return format(date, "HH:mm");
}

function fromFields(date: string, time: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1, hours || 0, minutes || 0, 0, 0);
}

export function EventDialog({
  state,
  calendars,
  onClose,
  onSave,
  onDelete,
}: {
  state: EditorState;
  calendars: Calendar[];
  onClose: () => void;
  onSave: (event: CalEvent, isNew: boolean) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const existing = state.kind === "edit" ? state.event : null;
  const initialStart = state.kind === "edit" ? parseStamp(state.event.start) : state.start;
  const initialEnd = state.kind === "edit" ? parseStamp(state.event.end) : state.end;
  const initialAllDay = state.kind === "edit" ? state.event.allDay : state.allDay;
  const displayEnd = initialAllDay ? addDays(startOfDay(initialEnd), -1) : initialEnd;
  const safeEnd = displayEnd < startOfDay(initialStart) ? initialStart : displayEnd;

  const [title, setTitle] = useState(existing?.title ?? "");
  const [calendarId, setCalendarId] = useState(
    existing?.calendarId || calendars[0]?.id || "",
  );
  const [allDay, setAllDay] = useState(initialAllDay);
  const [startDate, setStartDate] = useState(dateValue(initialStart));
  const [startTime, setStartTime] = useState(timeValue(initialStart));
  const [endDate, setEndDate] = useState(dateValue(safeEnd));
  const [endTime, setEndTime] = useState(timeValue(initialAllDay ? initialStart : initialEnd));
  const [location, setLocation] = useState(existing?.location ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [freq, setFreq] = useState<Freq | "none">(existing?.recurrence?.freq ?? "none");
  const [interval, setInterval] = useState(String(existing?.recurrence?.interval ?? 1));
  const [until, setUntil] = useState(existing?.recurrence?.until ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [armed, setArmed] = useState(false);

  async function submit() {
    const cleaned = title.trim();
    if (!cleaned) {
      setError("Add a title.");
      return;
    }
    if (!calendarId) {
      setError("Add a calendar first.");
      return;
    }
    const start = allDay ? fromFields(startDate, "00:00") : fromFields(startDate, startTime);
    const end = allDay ? addDays(fromFields(endDate, "00:00"), 1) : fromFields(endDate, endTime);
    if (!(end.getTime() > start.getTime())) {
      setError("The end needs to be after the start.");
      return;
    }
    let recurrence: Recurrence | null = null;
    if (freq !== "none") {
      const every = Math.max(1, Math.floor(Number(interval) || 1));
      recurrence = { freq, interval: every, until: until || undefined };
    }
    const event: CalEvent = {
      id: existing?.id ?? crypto.randomUUID(),
      calendarId,
      title: cleaned,
      description: description.trim(),
      location: location.trim(),
      start: start.toISOString(),
      end: end.toISOString(),
      allDay,
      recurrence,
    };
    setPending(true);
    setError(null);
    try {
      await onSave(event, !existing);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the event.");
      setPending(false);
    }
  }

  const unit =
    freq === "daily" ? "day" : freq === "weekly" ? "week" : freq === "monthly" ? "month" : "year";

  return (
    <Modal
      open
      title={existing ? "Edit event" : "New event"}
      description={
        existing?.recurrence
          ? "This repeats. Saving changes the whole series."
          : "Times are saved in your local timezone."
      }
      onClose={onClose}
    >
      <form
        className="space-y-4 px-4 py-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div>
          <label htmlFor="event-title" className="mb-1 block text-sm text-muted">
            Title
          </label>
          <input
            id="event-title"
            autoFocus
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Add a title"
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="event-calendar" className="mb-1 block text-sm text-muted">
            Calendar
          </label>
          <select
            id="event-calendar"
            value={calendarId}
            onChange={(event) => setCalendarId(event.target.value)}
            className={fieldClass}
          >
            {calendars.map((calendar) => (
              <option key={calendar.id} value={calendar.id}>
                {calendar.name} · {tone(calendar.color).label}
              </option>
            ))}
          </select>
        </div>
        <label className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-line px-3">
          <span className="text-sm">All day</span>
          <input
            type="checkbox"
            checked={allDay}
            onChange={(event) => setAllDay(event.target.checked)}
            className="size-4 accent-accent"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="start-date" className="mb-1 block text-sm text-muted">
              Starts
            </label>
            <input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className={fieldClass}
            />
          </div>
          {allDay ? null : (
            <div>
              <label htmlFor="start-time" className="mb-1 block text-sm text-muted">
                Start time
              </label>
              <input
                id="start-time"
                type="time"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
                className={fieldClass}
              />
            </div>
          )}
          <div>
            <label htmlFor="end-date" className="mb-1 block text-sm text-muted">
              Ends
            </label>
            <input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className={fieldClass}
            />
          </div>
          {allDay ? null : (
            <div>
              <label htmlFor="end-time" className="mb-1 block text-sm text-muted">
                End time
              </label>
              <input
                id="end-time"
                type="time"
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
                className={fieldClass}
              />
            </div>
          )}
        </div>
        <div>
          <label htmlFor="repeat" className="mb-1 block text-sm text-muted">
            Repeat
          </label>
          <select
            id="repeat"
            value={freq}
            onChange={(event) => setFreq(event.target.value as Freq | "none")}
            className={fieldClass}
          >
            {FREQS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
        {freq !== "none" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="interval" className="mb-1 block text-sm text-muted">
                Every
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="interval"
                  type="number"
                  min={1}
                  max={99}
                  value={interval}
                  onChange={(event) => setInterval(event.target.value)}
                  className={fieldClass}
                />
                <span className="text-sm text-muted">
                  {unit}
                  {Number(interval) === 1 ? "" : "s"}
                </span>
              </div>
            </div>
            <div>
              <label htmlFor="until" className="mb-1 block text-sm text-muted">
                Until
              </label>
              <input
                id="until"
                type="date"
                value={until}
                onChange={(event) => setUntil(event.target.value)}
                className={fieldClass}
              />
            </div>
          </div>
        ) : null}
        <div>
          <label htmlFor="location" className="mb-1 block text-sm text-muted">
            Location
          </label>
          <input
            id="location"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder="Optional"
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="description" className="mb-1 block text-sm text-muted">
            Notes
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            className="w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm text-fg outline-none focus-visible:border-accent"
          />
        </div>
        {error ? <p className="text-sm text-cal-tomato">{error}</p> : null}
        <div className="flex flex-wrap items-center gap-2 pb-2">
          <button
            type="submit"
            disabled={pending}
            className="h-11 rounded-full bg-accent px-5 text-sm font-semibold text-accent-fg disabled:opacity-50"
          >
            Save
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-full px-4 text-sm text-muted hover:bg-raised hover:text-fg"
          >
            Cancel
          </button>
          {existing ? (
            <button
              type="button"
              className="ml-auto h-11 rounded-full px-4 text-sm text-cal-tomato hover:bg-raised"
              onClick={() => {
                if (!armed) {
                  setArmed(true);
                  return;
                }
                setPending(true);
                void onDelete(existing.id)
                  .then(onClose)
                  .catch((err: unknown) => {
                    setError(err instanceof Error ? err.message : "Could not delete the event.");
                    setPending(false);
                    setArmed(false);
                  });
              }}
            >
              {armed ? "Confirm delete" : "Delete"}
            </button>
          ) : null}
        </div>
      </form>
    </Modal>
  );
}
