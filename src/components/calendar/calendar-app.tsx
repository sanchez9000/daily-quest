import { useEffect, useMemo, useState } from "react";
import {
  addDays,
  addMinutes,
  addMonths,
  addWeeks,
  addYears,
  format,
  startOfDay,
} from "date-fns";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Menu,
  Plus,
  Search,
  Settings,
  X,
} from "lucide-react";
import clsx from "clsx";
import { AgendaView } from "@/components/calendar/agenda-view";
import { EventDialog, type EditorState } from "@/components/calendar/event-dialog";
import { MonthView } from "@/components/calendar/month-view";
import { SettingsDialog } from "@/components/calendar/settings-dialog";
import { Sidebar } from "@/components/calendar/sidebar";
import { DayStrip, TimeGrid } from "@/components/calendar/time-grid";
import { atTime, expandEvents, fromDayKey, parseStamp, weekDays } from "@/lib/calendar/occur";
import { useCal } from "@/lib/calendar/store";
import type { CalView } from "@/lib/calendar/types";

const VIEWS: { id: CalView; label: string }[] = [
  { id: "month", label: "Month" },
  { id: "week", label: "Week" },
  { id: "day", label: "Day" },
  { id: "agenda", label: "Agenda" },
];

export function CalendarApp() {
  const hydrated = useCal((state) => state.hydrated);
  const calendars = useCal((state) => state.calendars);
  const events = useCal((state) => state.events);
  const hiddenIds = useCal((state) => state.hiddenIds);
  const view = useCal((state) => state.view);
  const anchorKey = useCal((state) => state.anchor);
  const settings = useCal((state) => state.settings);
  const syncing = useCal((state) => state.syncing);
  const syncError = useCal((state) => state.syncError);
  const lastSync = useCal((state) => state.lastSync);
  const finishHydration = useCal((state) => state.finishHydration);
  const setView = useCal((state) => state.setView);
  const setAnchor = useCal((state) => state.setAnchor);
  const patchSettings = useCal((state) => state.patchSettings);
  const toggleHidden = useCal((state) => state.toggleHidden);
  const dismissError = useCal((state) => state.dismissError);
  const saveCalendar = useCal((state) => state.saveCalendar);
  const removeCalendar = useCal((state) => state.removeCalendar);
  const saveEvent = useCal((state) => state.saveEvent);
  const removeEvent = useCal((state) => state.removeEvent);
  const download = useCal((state) => state.download);
  const upload = useCal((state) => state.upload);

  const [drawer, setDrawer] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const persistApi = useCal.persist;
    const run = () => {
      if (!useCal.getState().hydrated) finishHydration();
    };
    const unsub = persistApi.onFinishHydration(run);
    if (persistApi.hasHydrated()) run();
    else void persistApi.rehydrate();
    return unsub;
  }, [finishHydration]);

  const anchor = fromDayKey(anchorKey);
  const week = weekDays(anchor, settings.weekStartsOn);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    const start = addMonths(anchor, -1);
    const end = addYears(anchor, 1);
    return expandEvents(events, hiddenIds, start, end)
      .filter((event) =>
        `${event.title} ${event.location} ${event.description}`.toLowerCase().includes(needle),
      )
      .slice(0, 8);
  }, [anchor, events, hiddenIds, query]);

  function shift(direction: number) {
    const next =
      view === "month"
        ? addMonths(anchor, direction)
        : view === "week" || view === "agenda"
          ? addWeeks(anchor, direction)
          : addDays(anchor, direction);
    setAnchor(format(next, "yyyy-MM-dd"));
  }

  function goToday() {
    setAnchor(format(new Date(), "yyyy-MM-dd"));
  }

  function openCreate(day: Date, hours = 9, minutes = 0) {
    const start = atTime(day, hours, minutes);
    setEditor({ kind: "new", start, end: addMinutes(start, 60), allDay: false });
  }

  function openAllDay(day: Date) {
    const start = startOfDay(day);
    setEditor({ kind: "new", start, end: addDays(start, 1), allDay: true });
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable) return;
      if (editor || settingsOpen) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        shift(-1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        shift(1);
      } else if (event.key === "t" || event.key === "T") goToday();
      else if (event.key === "c" || event.key === "C") openCreate(anchor);
      else if (event.key === "1") setView("month");
      else if (event.key === "2") setView("week");
      else if (event.key === "3") setView("day");
      else if (event.key === "4") setView("agenda");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!hydrated) {
    return (
      <div className="flex h-dvh flex-col bg-canvas text-fg">
        <div className="flex h-14 items-center gap-3 border-b border-line px-4">
          <span className="grid size-8 place-items-center rounded-lg bg-accent text-accent-fg">
            <CalendarDays className="size-5" />
          </span>
          <span className="min-w-0 truncate text-base font-semibold tracking-tight">Daily Quest</span>
        </div>
        <p className="px-4 py-4 text-sm text-muted">Loading your schedule…</p>
        <div className="mx-4 grid min-h-0 flex-1 grid-cols-7 border-t border-l border-line">
          {Array.from({ length: 35 }).map((_, index) => (
            <div key={index} className="border-r border-b border-line" />
          ))}
        </div>
      </div>
    );
  }

  const title =
    view === "month"
      ? format(anchor, "MMMM yyyy")
      : view === "day"
        ? format(anchor, "EEE, MMM d")
        : view === "agenda"
          ? "Upcoming"
          : weekTitle(week);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-canvas text-fg">
      <header className="shrink-0 border-b border-line">
        <div className="flex h-14 items-center gap-2 px-3">
          <button
            type="button"
            className="grid size-11 place-items-center rounded-full hover:bg-raised md:hidden"
            aria-label="Open calendars"
            onClick={() => setDrawer(true)}
          >
            <Menu className="size-5" />
          </button>
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-accent-fg">
            <CalendarDays className="size-5" />
          </span>
          <span className="min-w-0 truncate text-base font-semibold tracking-tight">Daily Quest</span>
          <div className="flex-1" />
          <div className="relative hidden md:block">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search"
              aria-label="Search events"
              className="h-10 w-56 rounded-full border border-line bg-ink pr-3 pl-9 text-sm outline-none focus-visible:border-accent"
            />
            {query.trim() ? <SearchResults results={results} onPick={pickResult} /> : null}
          </div>
          <button
            type="button"
            className="grid size-11 place-items-center rounded-full hover:bg-raised md:hidden"
            aria-label={searchOpen ? "Close search" : "Search events"}
            onClick={() => setSearchOpen((open) => !open)}
          >
            {searchOpen ? <X className="size-5" /> : <Search className="size-5" />}
          </button>
          <button
            type="button"
            className="grid size-11 place-items-center rounded-full hover:bg-raised"
            aria-label="Settings"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings className="size-5" />
          </button>
        </div>
        {searchOpen ? (
          <div className="relative px-3 pb-2 md:hidden">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search events"
              aria-label="Search events"
              className="h-11 w-full rounded-lg border border-line bg-ink px-3 text-sm outline-none focus-visible:border-accent"
            />
            {query.trim() ? <SearchResults results={results} onPick={pickResult} /> : null}
          </div>
        ) : null}
        <div className="flex flex-col gap-2 px-3 pb-3 md:flex-row md:items-center">
          <div className="flex min-w-0 items-center gap-1">
            <button
              type="button"
              onClick={goToday}
              className="h-11 rounded-full border border-line px-3 text-sm font-medium hover:bg-raised"
            >
              Today
            </button>
            <button
              type="button"
              aria-label="Previous"
              onClick={() => shift(-1)}
              className="grid size-11 place-items-center rounded-full hover:bg-raised"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              aria-label="Next"
              onClick={() => shift(1)}
              className="grid size-11 place-items-center rounded-full hover:bg-raised"
            >
              <ChevronRight className="size-5" />
            </button>
            <h1 className="min-w-0 flex-1 truncate px-1 text-lg font-semibold tracking-tight tabular-nums">
              {title}
            </h1>
          </div>
          <div className="grid grid-cols-4 rounded-full bg-ink p-1 md:ml-auto md:flex">
            {VIEWS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={view === item.id}
                onClick={() => setView(item.id)}
                className={clsx(
                  "h-11 rounded-full px-3 text-sm",
                  view === item.id ? "bg-raised font-medium text-fg" : "text-muted",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        {syncing ? <div className="h-0.5 bg-accent" /> : null}
        {syncError ? (
          <div className="flex items-start gap-3 border-t border-cal-tomato/30 bg-cal-tomato/10 px-4 py-2 text-sm text-cal-tomato">
            <p className="min-w-0 flex-1 text-pretty">{syncError}</p>
            <button type="button" className="shrink-0 font-medium" onClick={dismissError}>
              Dismiss
            </button>
          </div>
        ) : null}
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-72 shrink-0 border-r border-line md:block">
          <Sidebar
            anchor={anchor}
            weekStartsOn={settings.weekStartsOn}
            calendars={calendars}
            events={events}
            hiddenIds={hiddenIds}
            onPickDay={(day) => setAnchor(format(day, "yyyy-MM-dd"))}
            onCreate={() => openCreate(anchor)}
            onToggle={toggleHidden}
            onSaveCalendar={saveCalendar}
            onDeleteCalendar={removeCalendar}
          />
        </aside>
        <main className="h-full min-h-0 min-w-0 flex-1" aria-label="Calendar">
          {view === "month" ? (
            <MonthView
              anchor={anchor}
              weekStartsOn={settings.weekStartsOn}
              calendars={calendars}
              events={events}
              hiddenIds={hiddenIds}
              onCreate={(day) => openCreate(day)}
              onOpen={(event) => setEditor({ kind: "edit", event })}
              onOpenDay={(day) => {
                setAnchor(format(day, "yyyy-MM-dd"));
                setView("day");
              }}
            />
          ) : null}
          {view === "week" ? (
            <>
              <div className="flex h-full min-h-0 flex-col md:hidden">
                <DayStrip
                  days={week}
                  anchor={anchor}
                  onPick={(day) => setAnchor(format(day, "yyyy-MM-dd"))}
                />
                <TimeGrid
                  days={[anchor]}
                  calendars={calendars}
                  events={events}
                  hiddenIds={hiddenIds}
                  onCreate={(start) =>
                    setEditor({ kind: "new", start, end: addMinutes(start, 60), allDay: false })
                  }
                  onCreateAllDay={openAllDay}
                  onOpen={(event) => setEditor({ kind: "edit", event })}
                  onOpenDay={(day) => {
                    setAnchor(format(day, "yyyy-MM-dd"));
                    setView("day");
                  }}
                />
              </div>
              <div className="hidden h-full md:block">
                <TimeGrid
                  days={week}
                  calendars={calendars}
                  events={events}
                  hiddenIds={hiddenIds}
                  onCreate={(start) =>
                    setEditor({ kind: "new", start, end: addMinutes(start, 60), allDay: false })
                  }
                  onCreateAllDay={openAllDay}
                  onOpen={(event) => setEditor({ kind: "edit", event })}
                  onOpenDay={(day) => {
                    setAnchor(format(day, "yyyy-MM-dd"));
                    setView("day");
                  }}
                />
              </div>
            </>
          ) : null}
          {view === "day" ? (
            <TimeGrid
              days={[anchor]}
              calendars={calendars}
              events={events}
              hiddenIds={hiddenIds}
              onCreate={(start) =>
                setEditor({ kind: "new", start, end: addMinutes(start, 60), allDay: false })
              }
              onCreateAllDay={openAllDay}
              onOpen={(event) => setEditor({ kind: "edit", event })}
              onOpenDay={(day) => setAnchor(format(day, "yyyy-MM-dd"))}
            />
          ) : null}
          {view === "agenda" ? (
            <AgendaView
              anchor={anchor}
              calendars={calendars}
              events={events}
              hiddenIds={hiddenIds}
              onOpen={(event) => setEditor({ kind: "edit", event })}
              onCreate={(day) => openCreate(day)}
            />
          ) : null}
        </main>
      </div>

      <button
        type="button"
        onClick={() => openCreate(anchor)}
        className="fixed right-4 bottom-24 z-30 grid size-14 place-items-center rounded-full bg-accent text-accent-fg shadow-lg md:hidden"
        aria-label="Create event"
      >
        <Plus className="size-6" />
      </button>

      {drawer ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-ink/70"
            aria-label="Close calendars"
            onClick={() => setDrawer(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85%] border-r border-line bg-canvas">
            <Sidebar
              anchor={anchor}
              weekStartsOn={settings.weekStartsOn}
              calendars={calendars}
              events={events}
              hiddenIds={hiddenIds}
              onPickDay={(day) => {
                setAnchor(format(day, "yyyy-MM-dd"));
                setDrawer(false);
              }}
              onCreate={() => {
                setDrawer(false);
                openCreate(anchor);
              }}
              onToggle={toggleHidden}
              onSaveCalendar={saveCalendar}
              onDeleteCalendar={removeCalendar}
            />
          </aside>
        </div>
      ) : null}

      {editor ? (
        <EventDialog
          key={editor.kind === "edit" ? editor.event.id : editor.start.toISOString()}
          state={editor}
          calendars={calendars}
          onClose={() => setEditor(null)}
          onSave={saveEvent}
          onDelete={removeEvent}
        />
      ) : null}
      {settingsOpen ? (
        <SettingsDialog
          settings={settings}
          lastSync={lastSync}
          syncing={syncing}
          onClose={() => setSettingsOpen(false)}
          onChange={patchSettings}
          onDownload={download}
          onUpload={upload}
        />
      ) : null}
    </div>
  );

  function pickResult(day: Date, eventId: string) {
    const event = events.find((item) => item.id === eventId);
    setAnchor(format(day, "yyyy-MM-dd"));
    setView("day");
    setQuery("");
    setSearchOpen(false);
    if (event) setEditor({ kind: "edit", event });
  }
}

function SearchResults({
  results,
  onPick,
}: {
  results: { key: string; id: string; title: string; start: string; allDay: boolean }[];
  onPick: (day: Date, id: string) => void;
}) {
  if (!results.length) {
    return (
      <p className="absolute top-full right-0 z-30 mt-1 w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-muted">
        No matching events
      </p>
    );
  }
  return (
    <ul className="absolute top-full right-0 z-30 mt-1 max-h-80 w-full overflow-y-auto rounded-lg border border-line bg-panel shadow-lg md:w-72">
      {results.map((event) => (
        <li key={event.key}>
          <button
            type="button"
            className="flex min-h-11 w-full flex-col items-start px-3 py-2 text-left hover:bg-raised"
            onClick={() => onPick(parseStamp(event.start), event.id)}
          >
            <span className="truncate text-sm font-medium">{event.title}</span>
            <span className="text-xs text-muted tabular-nums">
              {format(parseStamp(event.start), event.allDay ? "EEE, MMM d" : "EEE, MMM d, h:mm a")}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function weekTitle(days: Date[]): string {
  const start = days[0];
  const end = days[6];
  if (!start || !end) return "";
  if (start.getFullYear() !== end.getFullYear()) {
    return `${format(start, "MMM d, yyyy")} – ${format(end, "MMM d, yyyy")}`;
  }
  if (start.getMonth() !== end.getMonth()) {
    return `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`;
  }
  return `${format(start, "MMMM d")} – ${format(end, "d, yyyy")}`;
}
