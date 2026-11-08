import { format } from "date-fns";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  deleteCalendar,
  deleteEvent,
  downloadSchedule,
  saveCalendar,
  saveEvent,
} from "@/lib/calendar/api";
import { makeSeed } from "@/lib/calendar/seed";
import {
  defaultSettings,
  type Calendar,
  type CalEvent,
  type CalView,
  type Settings,
} from "@/lib/calendar/types";

type State = {
  bootstrapped: boolean;
  hydrated: boolean;
  calendars: Calendar[];
  events: CalEvent[];
  hiddenIds: string[];
  view: CalView;
  anchor: string;
  settings: Settings;
  syncing: boolean;
  syncError: string | null;
  lastSync: string | null;
};

type Actions = {
  finishHydration: () => void;
  setView: (view: CalView) => void;
  setAnchor: (anchor: string) => void;
  patchSettings: (patch: Partial<Settings>) => void;
  toggleHidden: (id: string) => void;
  dismissError: () => void;
  saveCalendar: (calendar: Calendar, isNew: boolean) => Promise<void>;
  removeCalendar: (id: string) => Promise<void>;
  saveEvent: (event: CalEvent, isNew: boolean) => Promise<void>;
  removeEvent: (id: string) => Promise<void>;
  download: () => Promise<void>;
  upload: () => Promise<string>;
};

export const useCal = create<State & Actions>()(
  persist(
    (set, get) => ({
      bootstrapped: false,
      hydrated: false,
      calendars: [],
      events: [],
      hiddenIds: [],
      view: "month",
      anchor: format(new Date(), "yyyy-MM-dd"),
      settings: defaultSettings,
      syncing: false,
      syncError: null,
      lastSync: null,

      finishHydration: () => {
        const state = get();
        if (!state.bootstrapped) {
          const seed = makeSeed(new Date());
          set({
            calendars: seed.calendars,
            events: seed.events,
            bootstrapped: true,
            anchor: format(new Date(), "yyyy-MM-dd"),
            hydrated: true,
          });
          return;
        }
        set({ hydrated: true });
      },

      setView: (view) => set({ view }),
      setAnchor: (anchor) => set({ anchor }),
      patchSettings: (patch) => set({ settings: { ...get().settings, ...patch } }),
      toggleHidden: (id) => {
        const hidden = new Set(get().hiddenIds);
        if (hidden.has(id)) hidden.delete(id);
        else hidden.add(id);
        set({ hiddenIds: [...hidden] });
      },
      dismissError: () => set({ syncError: null }),

      saveCalendar: async (calendar, isNew) => {
        const prev = get().calendars;
        const next = isNew
          ? [...prev, calendar]
          : prev.map((item) => (item.id === calendar.id ? calendar : item));
        set({ calendars: next, syncError: null });
        if (get().settings.mode !== "api") return;
        set({ syncing: true });
        try {
          const saved = await saveCalendar(get().settings, calendar, isNew);
          set({
            calendars: get().calendars.map((item) => (item.id === calendar.id ? saved : item)),
            syncing: false,
          });
        } catch (error) {
          set({
            calendars: prev,
            syncing: false,
            syncError: error instanceof Error ? error.message : "Could not save the calendar.",
          });
          throw error;
        }
      },

      removeCalendar: async (id) => {
        const prevCals = get().calendars;
        const prevEvents = get().events;
        set({
          calendars: prevCals.filter((item) => item.id !== id),
          events: prevEvents.filter((item) => item.calendarId !== id),
          syncError: null,
        });
        if (get().settings.mode !== "api") return;
        set({ syncing: true });
        try {
          await deleteCalendar(get().settings, id);
          set({ syncing: false });
        } catch (error) {
          set({
            calendars: prevCals,
            events: prevEvents,
            syncing: false,
            syncError: error instanceof Error ? error.message : "Could not delete the calendar.",
          });
          throw error;
        }
      },

      saveEvent: async (event, isNew) => {
        const prev = get().events;
        const next = isNew
          ? [...prev, event]
          : prev.map((item) => (item.id === event.id ? event : item));
        set({ events: next, syncError: null });
        if (get().settings.mode !== "api") return;
        set({ syncing: true });
        try {
          const saved = await saveEvent(get().settings, event, isNew);
          set({
            events: get().events.map((item) => (item.id === event.id ? saved : item)),
            syncing: false,
          });
        } catch (error) {
          set({
            events: prev,
            syncing: false,
            syncError: error instanceof Error ? error.message : "Could not save the event.",
          });
          throw error;
        }
      },

      removeEvent: async (id) => {
        const prev = get().events;
        set({ events: prev.filter((item) => item.id !== id), syncError: null });
        if (get().settings.mode !== "api") return;
        set({ syncing: true });
        try {
          await deleteEvent(get().settings, id);
          set({ syncing: false });
        } catch (error) {
          set({
            events: prev,
            syncing: false,
            syncError: error instanceof Error ? error.message : "Could not delete the event.",
          });
          throw error;
        }
      },

      download: async () => {
        const settings = get().settings;
        if (settings.mode !== "api") throw new Error("Switch schedule storage to your private API first.");
        set({ syncing: true, syncError: null });
        try {
          const data = await downloadSchedule(settings);
          const ids = new Set(data.calendars.map((calendar) => calendar.id));
          set({
            calendars: data.calendars,
            events: data.events,
            hiddenIds: get().hiddenIds.filter((id) => ids.has(id)),
            syncing: false,
            lastSync: new Date().toISOString(),
          });
        } catch (error) {
          set({
            syncing: false,
            syncError: error instanceof Error ? error.message : "Could not download the schedule.",
          });
          throw error;
        }
      },

      upload: async () => {
        const settings = get().settings;
        if (settings.mode !== "api") throw new Error("Switch schedule storage to your private API first.");
        set({ syncing: true, syncError: null });
        const idMap = new Map<string, string>();
        try {
          const sourceCalendars = get().calendars;
          const sourceEvents = get().events;
          const calendars: Calendar[] = [];
          for (const calendar of sourceCalendars) {
            const saved = await saveCalendar(settings, calendar, true);
            idMap.set(calendar.id, saved.id);
            calendars.push(saved);
          }
          const events: CalEvent[] = [];
          for (const event of sourceEvents) {
            const next = {
              ...event,
              calendarId: idMap.get(event.calendarId) ?? event.calendarId,
            };
            events.push(await saveEvent(settings, next, true));
          }
          set({
            calendars,
            events,
            syncing: false,
            lastSync: new Date().toISOString(),
          });
          return `Uploaded ${calendars.length} calendars and ${events.length} events.`;
        } catch (error) {
          set({
            syncing: false,
            syncError: error instanceof Error ? error.message : "Upload stopped before it finished.",
          });
          throw error;
        }
      },
    }),
    {
      name: "daily-quest-v1",
      skipHydration: true,
      partialize: (state) => ({
        bootstrapped: state.bootstrapped,
        calendars: state.calendars,
        events: state.events,
        hiddenIds: state.hiddenIds,
        view: state.view,
        anchor: state.anchor,
        settings: state.settings,
        lastSync: state.lastSync,
      }),
    },
  ),
);
