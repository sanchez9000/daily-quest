import { useEffect, useMemo, useState } from "react";
import { addDays, addMonths, format, isSameMonth, isToday } from "date-fns";
import { Check, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import clsx from "clsx";
import { monthGrid } from "@/lib/calendar/occur";
import { expandEvents, coversDay } from "@/lib/calendar/occur";
import { CAL_COLORS, tone, type Calendar, type CalColor, type CalEvent } from "@/lib/calendar/types";
import { fieldClass } from "@/components/calendar/modal";

export function Sidebar({
  anchor,
  weekStartsOn,
  calendars,
  events,
  hiddenIds,
  onPickDay,
  onCreate,
  onToggle,
  onSaveCalendar,
  onDeleteCalendar,
}: {
  anchor: Date;
  weekStartsOn: 0 | 1;
  calendars: Calendar[];
  events: CalEvent[];
  hiddenIds: string[];
  onPickDay: (day: Date) => void;
  onCreate: () => void;
  onToggle: (id: string) => void;
  onSaveCalendar: (calendar: Calendar, isNew: boolean) => Promise<void>;
  onDeleteCalendar: (id: string) => Promise<void>;
}) {
  const [cursor, setCursor] = useState(anchor);
  const [editing, setEditing] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftColor, setDraftColor] = useState<CalColor>("teal");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCursor(anchor);
  }, [anchor]);

  const weeks = monthGrid(cursor, weekStartsOn);
  const busy = useMemo(() => {
    const start = weeks[0]?.[0] ?? cursor;
    const end = addDays(weeks[weeks.length - 1]?.[6] ?? cursor, 1);
    const occ = expandEvents(events, hiddenIds, start, end);
    const keys = new Set<string>();
    for (const day of weeks.flat()) {
      if (occ.some((event) => coversDay(event, day))) keys.add(format(day, "yyyy-MM-dd"));
    }
    return keys;
  }, [cursor, events, hiddenIds, weekStartsOn, weeks]);

  async function addCalendar() {
    const name = draftName.trim();
    if (!name) return;
    setError(null);
    try {
      await onSaveCalendar(
        { id: crypto.randomUUID(), name, color: draftColor },
        true,
      );
      setDraftName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the calendar.");
    }
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto px-3 py-4">
      <button
        type="button"
        onClick={onCreate}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg hover:opacity-90"
      >
        <Plus className="size-4" />
        Create
      </button>

      <div>
        <div className="mb-2 flex items-center justify-between px-1">
          <p className="text-sm font-semibold tabular-nums">{format(cursor, "MMMM yyyy")}</p>
          <div className="flex">
            <button
              type="button"
              className="grid size-9 place-items-center rounded-full text-muted hover:bg-raised hover:text-fg"
              aria-label="Previous month"
              onClick={() => setCursor(addMonths(cursor, -1))}
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              className="grid size-9 place-items-center rounded-full text-muted hover:bg-raised hover:text-fg"
              aria-label="Next month"
              onClick={() => setCursor(addMonths(cursor, 1))}
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 px-1 text-center text-xs text-faint">
          {weeks[0]?.map((day) => (
            <span key={day.toISOString()}>{format(day, "EEEEE")}</span>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7">
          {weeks.flat().map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const selected = format(anchor, "yyyy-MM-dd") === key;
            const today = isToday(day);
            return (
              <button
                key={key}
                type="button"
                onClick={() => onPickDay(day)}
                className="flex h-9 flex-col items-center justify-center"
              >
                <span
                  className={clsx(
                    "grid size-7 place-items-center rounded-full text-xs tabular-nums",
                    selected && "bg-accent text-accent-fg",
                    !selected && today && "text-accent",
                    !selected && !isSameMonth(day, cursor) && "text-faint",
                  )}
                >
                  {format(day, "d")}
                </span>
                <span
                  className={clsx("mt-0.5 size-1 rounded-full", busy.has(key) ? "bg-accent" : "bg-transparent")}
                />
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="px-1 text-xs font-semibold tracking-wide text-faint uppercase">Calendars</p>
        <ul className="mt-1">
          {calendars.map((calendar) => {
            const visible = !hiddenIds.includes(calendar.id);
            const colors = tone(calendar.color);
            return (
              <li key={calendar.id}>
                <div className="flex items-center">
                  <button
                    type="button"
                    aria-pressed={visible}
                    onClick={() => onToggle(calendar.id)}
                    className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg px-1 text-left hover:bg-raised"
                  >
                    <span
                      className={clsx(
                        "grid size-5 shrink-0 place-items-center rounded",
                        visible ? colors.solid : "border border-line",
                      )}
                    >
                      {visible ? <Check className="size-3.5 text-accent-fg" /> : null}
                    </span>
                    <span className="truncate text-sm">{calendar.name}</span>
                  </button>
                  <button
                    type="button"
                    className="grid size-11 shrink-0 place-items-center rounded-full text-xs text-muted hover:bg-raised hover:text-fg"
                    aria-label={`Edit ${calendar.name}`}
                    onClick={() => setEditing(editing === calendar.id ? null : calendar.id)}
                  >
                    Edit
                  </button>
                </div>
                {editing === calendar.id ? (
                  <CalendarEditor
                    calendar={calendar}
                    onSave={onSaveCalendar}
                    onDelete={onDeleteCalendar}
                    onDone={() => setEditing(null)}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
        {calendars.length === 0 ? (
          <p className="px-1 text-sm text-muted">No calendars yet. Add one below.</p>
        ) : null}
        <form
          className="mt-3 space-y-2 px-1"
          onSubmit={(event) => {
            event.preventDefault();
            void addCalendar();
          }}
        >
          <label className="block text-xs text-muted" htmlFor="new-calendar">
            New calendar
          </label>
          <input
            id="new-calendar"
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            placeholder="Name"
            className={fieldClass}
          />
          <ColorPicker value={draftColor} onChange={setDraftColor} />
          <button
            type="submit"
            disabled={!draftName.trim()}
            className="h-11 w-full rounded-lg border border-line text-sm font-medium hover:bg-raised disabled:opacity-40"
          >
            Add calendar
          </button>
          {error ? <p className="text-sm text-cal-tomato">{error}</p> : null}
        </form>
      </div>
    </div>
  );
}

function CalendarEditor({
  calendar,
  onSave,
  onDelete,
  onDone,
}: {
  calendar: Calendar;
  onSave: (calendar: Calendar, isNew: boolean) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onDone: () => void;
}) {
  const [name, setName] = useState(calendar.name);
  const [color, setColor] = useState<CalColor>(calendar.color);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="mb-2 space-y-2 rounded-lg border border-line bg-ink p-2"
      onSubmit={(event) => {
        event.preventDefault();
        setPending(true);
        setError(null);
        void onSave({ ...calendar, name: name.trim() || calendar.name, color }, false)
          .then(onDone)
          .catch((err: unknown) => {
            setError(err instanceof Error ? err.message : "Could not save.");
          })
          .finally(() => setPending(false));
      }}
    >
      <input value={name} onChange={(event) => setName(event.target.value)} className={fieldClass} aria-label="Calendar name" />
      <ColorPicker value={color} onChange={setColor} />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="h-10 flex-1 rounded-lg bg-accent text-sm font-semibold text-accent-fg disabled:opacity-50"
        >
          Save
        </button>
        <button
          type="button"
          className="h-10 rounded-lg px-3 text-sm text-cal-tomato hover:bg-raised"
          onClick={() => {
            setPending(true);
            void onDelete(calendar.id)
              .then(onDone)
              .catch((err: unknown) => {
                setError(err instanceof Error ? err.message : "Could not delete.");
                setPending(false);
              });
          }}
        >
          Delete
        </button>
      </div>
      {error ? <p className="text-sm text-cal-tomato">{error}</p> : null}
    </form>
  );
}

export function ColorPicker({
  value,
  onChange,
}: {
  value: CalColor;
  onChange: (color: CalColor) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Calendar color">
      {CAL_COLORS.map((color) => {
        const colors = tone(color);
        const selected = value === color;
        return (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={colors.label}
            onClick={() => onChange(color)}
            className={clsx(
              "grid size-8 place-items-center rounded-full",
              selected && "ring-2 ring-fg ring-offset-2 ring-offset-canvas",
            )}
          >
            <span className={clsx("size-5 rounded-full", colors.solid)} />
          </button>
        );
      })}
    </div>
  );
}
