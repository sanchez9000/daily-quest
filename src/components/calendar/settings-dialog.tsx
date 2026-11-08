import { useState } from "react";
import { format, parseISO } from "date-fns";
import { fieldClass, Modal } from "@/components/calendar/modal";
import { testConnection } from "@/lib/calendar/api";
import type { ApiAuth, Settings } from "@/lib/calendar/types";

const CONTRACT = `Daily Quest calls your server. The base URL is only the prefix.

GET    {base}/calendars
POST   {base}/calendars
PATCH  {base}/calendars/{id}
DELETE {base}/calendars/{id}

GET    {base}/events?from=ISO&to=ISO
POST   {base}/events
PATCH  {base}/events/{id}
DELETE {base}/events/{id}

Calendar
{ "id": "cal_1", "name": "Work", "color": "sage" }
Colors: cobalt, sage, tomato, amber, violet, teal, rose, slate

Event
{
  "id": "evt_1",
  "calendarId": "cal_1",
  "title": "Standup",
  "description": "",
  "location": "Studio",
  "start": "2026-11-02T01:00:00.000Z",
  "end": "2026-11-02T01:30:00.000Z",
  "allDay": false,
  "recurrence": { "freq": "weekly", "interval": 1, "until": "2026-12-31" }
}

Lists may be a JSON array, or { "calendars": [] } / { "events": [] }.
All-day end is exclusive: the local midnight after the last day.
recurrence.freq is daily, weekly, monthly, or yearly. Omit until to repeat without an end.
Aliases accepted on read: summary, start.dateTime, start.date, rrule.

Direct calls come from the browser. Allow this app's origin in CORS
for GET, POST, PATCH, DELETE and headers Authorization, Content-Type, X-Api-Key.
Relay calls come from Daily Quest's server when the browser is blocked.
Relay cannot reach localhost. Use Direct for a server on your own machine or LAN.`;

export function SettingsDialog({
  settings,
  lastSync,
  syncing,
  onClose,
  onChange,
  onDownload,
  onUpload,
}: {
  settings: Settings;
  lastSync: string | null;
  syncing: boolean;
  onClose: () => void;
  onChange: (patch: Partial<Settings>) => void;
  onDownload: () => Promise<void>;
  onUpload: () => Promise<string>;
}) {
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeBad, setNoticeBad] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showToken, setShowToken] = useState(false);

  function report(message: string, bad = false) {
    setNotice(message);
    setNoticeBad(bad);
  }

  return (
    <Modal
      open
      title="Settings"
      description="Keep the schedule on this device, or read and write it on your private API."
      onClose={onClose}
    >
      <div className="space-y-5 px-4 py-4">
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Schedule storage</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            <Choice
              pressed={settings.mode === "local"}
              label="This device"
              detail="Stays in this browser until you connect an API."
              onClick={() => onChange({ mode: "local" })}
            />
            <Choice
              pressed={settings.mode === "api"}
              label="Private API"
              detail="Your server. Not Google."
              onClick={() => onChange({ mode: "api" })}
            />
          </div>
        </fieldset>

        {settings.mode === "api" ? (
          <div className="space-y-3">
            <div>
              <label htmlFor="base-url" className="mb-1 block text-sm text-muted">
                Base URL
              </label>
              <input
                id="base-url"
                inputMode="url"
                placeholder="https://api.example.com/v1"
                value={settings.baseUrl}
                onChange={(event) => onChange({ baseUrl: event.target.value })}
                className={fieldClass}
              />
            </div>
            <div>
              <label htmlFor="auth-kind" className="mb-1 block text-sm text-muted">
                Authentication
              </label>
              <select
                id="auth-kind"
                value={settings.auth}
                onChange={(event) => onChange({ auth: event.target.value as ApiAuth })}
                className={fieldClass}
              >
                <option value="bearer">Bearer token</option>
                <option value="api-key">API key header</option>
                <option value="basic">Basic (user:password)</option>
                <option value="none">None</option>
              </select>
            </div>
            {settings.auth !== "none" ? (
              <div>
                <label htmlFor="token" className="mb-1 block text-sm text-muted">
                  {settings.auth === "basic" ? "Username:password" : "Token"}
                </label>
                <div className="flex gap-2">
                  <input
                    id="token"
                    type={showToken ? "text" : "password"}
                    value={settings.token}
                    onChange={(event) => onChange({ token: event.target.value })}
                    className={fieldClass}
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    className="h-11 shrink-0 rounded-lg border border-line px-3 text-sm"
                    onClick={() => setShowToken((value) => !value)}
                  >
                    {showToken ? "Hide" : "Show"}
                  </button>
                </div>
              </div>
            ) : null}
            {settings.auth === "api-key" ? (
              <div>
                <label htmlFor="header-name" className="mb-1 block text-sm text-muted">
                  Header name
                </label>
                <input
                  id="header-name"
                  value={settings.apiKeyHeader}
                  onChange={(event) => onChange({ apiKeyHeader: event.target.value })}
                  className={fieldClass}
                />
              </div>
            ) : null}
            <fieldset>
              <legend className="mb-2 text-sm text-muted">How to reach the server</legend>
              <div className="grid gap-2">
                <Choice
                  pressed={settings.transport === "direct"}
                  label="Direct"
                  detail="This phone or computer calls your server. Best for a machine on your network."
                  onClick={() => onChange({ transport: "direct" })}
                />
                <Choice
                  pressed={settings.transport === "relay"}
                  label="Relay"
                  detail="Daily Quest's server calls it for you when the browser is blocked. Not for localhost."
                  onClick={() => onChange({ transport: "relay" })}
                />
              </div>
            </fieldset>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={syncing}
                className="h-11 rounded-full border border-line px-4 text-sm font-medium hover:bg-raised disabled:opacity-50"
                onClick={() => {
                  void testConnection(settings)
                    .then((message) => report(message))
                    .catch((error: unknown) =>
                      report(error instanceof Error ? error.message : "Could not connect.", true),
                    );
                }}
              >
                Test connection
              </button>
              <button
                type="button"
                disabled={syncing}
                className="h-11 rounded-full border border-line px-4 text-sm font-medium hover:bg-raised disabled:opacity-50"
                onClick={() => {
                  void onDownload()
                    .then(() => report("Replaced this schedule with the server's."))
                    .catch((error: unknown) =>
                      report(error instanceof Error ? error.message : "Download failed.", true),
                    );
                }}
              >
                Download
              </button>
              <button
                type="button"
                disabled={syncing}
                className="h-11 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg disabled:opacity-50"
                onClick={() => {
                  void onUpload()
                    .then((message) => report(message))
                    .catch((error: unknown) =>
                      report(error instanceof Error ? error.message : "Upload failed.", true),
                    );
                }}
              >
                Upload
              </button>
            </div>
            <p className="text-xs text-pretty text-faint">
              Download replaces what you see here. Upload adds this device's calendars and events.
              It does not delete anything already on the server. If an upload stops halfway, check
              the server before trying again.
            </p>
            {lastSync ? (
              <p className="text-xs text-muted tabular-nums">
                Last exchange {format(parseISO(lastSync), "MMM d, h:mm a")}
              </p>
            ) : (
              <p className="text-xs text-muted">Not exchanged with the server yet.</p>
            )}
          </div>
        ) : null}

        {notice ? (
          <p className={noticeBad ? "text-sm text-cal-tomato" : "text-sm text-cal-sage"}>{notice}</p>
        ) : null}

        <fieldset>
          <legend className="mb-2 text-sm font-medium">Week starts on</legend>
          <div className="grid grid-cols-2 gap-2">
            <Choice
              pressed={settings.weekStartsOn === 0}
              label="Sunday"
              onClick={() => onChange({ weekStartsOn: 0 })}
            />
            <Choice
              pressed={settings.weekStartsOn === 1}
              label="Monday"
              onClick={() => onChange({ weekStartsOn: 1 })}
            />
          </div>
        </fieldset>

        <details className="rounded-lg border border-line">
          <summary className="min-h-11 cursor-pointer px-3 py-3 text-sm font-medium">
            API contract
          </summary>
          <div className="space-y-2 px-3 pb-3">
            <pre className="overflow-x-auto rounded-lg bg-ink p-3 text-xs leading-relaxed text-muted">
              {CONTRACT}
            </pre>
            <button
              type="button"
              className="h-10 rounded-lg border border-line px-3 text-sm"
              onClick={() => {
                void navigator.clipboard.writeText(CONTRACT).then(() => {
                  setCopied(true);
                });
              }}
            >
              {copied ? "Copied" : "Copy contract"}
            </button>
          </div>
        </details>

        <p className="pb-4 text-sm text-pretty text-muted">
          Install Daily Quest from the browser to use it as an app on Android, iPhone, iPad, Mac,
          Linux, and Windows. Look for Install app, or Add to Home Screen. It runs on its own,
          without a browser tab.
        </p>
      </div>
    </Modal>
  );
}

function Choice({
  pressed,
  label,
  detail,
  onClick,
}: {
  pressed: boolean;
  label: string;
  detail?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={
        pressed
          ? "rounded-lg border border-accent bg-accent/10 px-3 py-3 text-left"
          : "rounded-lg border border-line px-3 py-3 text-left hover:bg-raised"
      }
    >
      <span className="block text-sm font-medium">{label}</span>
      {detail ? <span className="mt-1 block text-xs text-pretty text-muted">{detail}</span> : null}
    </button>
  );
}
