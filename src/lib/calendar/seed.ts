import { addDays, startOfDay } from "date-fns";
import type { CalEvent, Calendar } from "@/lib/calendar/types";

function id(): string {
  return crypto.randomUUID();
}

function stamp(day: Date, hours: number, minutes: number): string {
  const next = new Date(day);
  next.setHours(hours, minutes, 0, 0);
  return next.toISOString();
}

export function makeSeed(now: Date): { calendars: Calendar[]; events: CalEvent[] } {
  const today = startOfDay(now);
  const personal: Calendar = { id: id(), name: "Personal", color: "cobalt" };
  const work: Calendar = { id: id(), name: "Work", color: "sage" };
  const family: Calendar = { id: id(), name: "Family", color: "amber" };

  const on = (offset: number) => addDays(today, offset);

  const events: CalEvent[] = [
    {
      id: id(),
      calendarId: work.id,
      title: "Standup",
      description: "Yesterday's blockers, today's plan.",
      location: "Studio",
      start: stamp(on(0), 9, 0),
      end: stamp(on(0), 9, 30),
      allDay: false,
      recurrence: { freq: "weekly", interval: 1 },
    },
    {
      id: id(),
      calendarId: work.id,
      title: "Team offsite",
      description: "Bring the roadmap notes.",
      location: "North hall",
      start: stamp(on(1), 0, 0),
      end: stamp(on(3), 0, 0),
      allDay: true,
      recurrence: null,
    },
    {
      id: id(),
      calendarId: work.id,
      title: "Product review",
      description: "",
      location: "Room 4",
      start: stamp(on(1), 13, 0),
      end: stamp(on(1), 14, 30),
      allDay: false,
      recurrence: null,
    },
    {
      id: id(),
      calendarId: work.id,
      title: "1:1",
      description: "",
      location: "",
      start: stamp(on(2), 15, 0),
      end: stamp(on(2), 15, 30),
      allDay: false,
      recurrence: null,
    },
    {
      id: id(),
      calendarId: personal.id,
      title: "Dentist",
      description: "",
      location: "Riverside Clinic",
      start: stamp(on(3), 11, 0),
      end: stamp(on(3), 12, 0),
      allDay: false,
      recurrence: null,
    },
    {
      id: id(),
      calendarId: personal.id,
      title: "Dinner with Maya",
      description: "",
      location: "Cafe Luna",
      start: stamp(on(4), 19, 0),
      end: stamp(on(4), 21, 0),
      allDay: false,
      recurrence: null,
    },
    {
      id: id(),
      calendarId: family.id,
      title: "Farmers market",
      description: "",
      location: "Town square",
      start: stamp(on(5), 0, 0),
      end: stamp(on(6), 0, 0),
      allDay: true,
      recurrence: null,
    },
    {
      id: id(),
      calendarId: family.id,
      title: "School play",
      description: "Seats in row C.",
      location: "Auditorium",
      start: stamp(on(10), 18, 0),
      end: stamp(on(10), 20, 0),
      allDay: false,
      recurrence: null,
    },
  ];

  return { calendars: [personal, work, family], events };
}
