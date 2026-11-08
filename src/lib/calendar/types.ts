export const CAL_COLORS = [
  "cobalt",
  "sage",
  "tomato",
  "amber",
  "violet",
  "teal",
  "rose",
  "slate",
] as const;

export type CalColor = (typeof CAL_COLORS)[number];

export type Freq = "daily" | "weekly" | "monthly" | "yearly";

export type Recurrence = {
  freq: Freq;
  interval: number;
  until?: string;
};

export type Calendar = {
  id: string;
  name: string;
  color: CalColor;
};

export type CalEvent = {
  id: string;
  calendarId: string;
  title: string;
  description: string;
  location: string;
  start: string;
  end: string;
  allDay: boolean;
  recurrence: Recurrence | null;
};

export type ApiAuth = "none" | "bearer" | "api-key" | "basic";
export type Transport = "direct" | "relay";
export type CalView = "month" | "week" | "day" | "agenda";

export type Settings = {
  mode: "local" | "api";
  baseUrl: string;
  auth: ApiAuth;
  token: string;
  apiKeyHeader: string;
  transport: Transport;
  weekStartsOn: 0 | 1;
};

export const defaultSettings: Settings = {
  mode: "local",
  baseUrl: "",
  auth: "bearer",
  token: "",
  apiKeyHeader: "X-Api-Key",
  transport: "direct",
  weekStartsOn: 0,
};

export type Tone = {
  label: string;
  dot: string;
  chip: string;
  block: string;
  solid: string;
};

export const PALETTE: Record<CalColor, Tone> = {
  cobalt: {
    label: "Cobalt",
    dot: "bg-cal-cobalt",
    chip: "bg-cal-cobalt/20 text-cal-cobalt",
    block: "border-cal-cobalt bg-cal-cobalt/15",
    solid: "bg-cal-cobalt",
  },
  sage: {
    label: "Sage",
    dot: "bg-cal-sage",
    chip: "bg-cal-sage/20 text-cal-sage",
    block: "border-cal-sage bg-cal-sage/15",
    solid: "bg-cal-sage",
  },
  tomato: {
    label: "Tomato",
    dot: "bg-cal-tomato",
    chip: "bg-cal-tomato/20 text-cal-tomato",
    block: "border-cal-tomato bg-cal-tomato/15",
    solid: "bg-cal-tomato",
  },
  amber: {
    label: "Amber",
    dot: "bg-cal-amber",
    chip: "bg-cal-amber/20 text-cal-amber",
    block: "border-cal-amber bg-cal-amber/15",
    solid: "bg-cal-amber",
  },
  violet: {
    label: "Violet",
    dot: "bg-cal-violet",
    chip: "bg-cal-violet/20 text-cal-violet",
    block: "border-cal-violet bg-cal-violet/15",
    solid: "bg-cal-violet",
  },
  teal: {
    label: "Teal",
    dot: "bg-cal-teal",
    chip: "bg-cal-teal/20 text-cal-teal",
    block: "border-cal-teal bg-cal-teal/15",
    solid: "bg-cal-teal",
  },
  rose: {
    label: "Rose",
    dot: "bg-cal-rose",
    chip: "bg-cal-rose/20 text-cal-rose",
    block: "border-cal-rose bg-cal-rose/15",
    solid: "bg-cal-rose",
  },
  slate: {
    label: "Slate",
    dot: "bg-cal-slate",
    chip: "bg-cal-slate/15 text-cal-slate",
    block: "border-cal-slate bg-cal-slate/15",
    solid: "bg-cal-slate",
  },
};

const COLOR_ALIASES: Record<string, CalColor> = {
  blue: "cobalt",
  green: "sage",
  red: "tomato",
  yellow: "amber",
  orange: "amber",
  purple: "violet",
  pink: "rose",
  gray: "slate",
  grey: "slate",
};

export function asColor(value: unknown): CalColor {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase();
  if ((CAL_COLORS as readonly string[]).includes(raw)) return raw as CalColor;
  return COLOR_ALIASES[raw] ?? "cobalt";
}

export function tone(color: CalColor | undefined): Tone {
  return PALETTE[color ?? "cobalt"] ?? PALETTE.cobalt;
}
