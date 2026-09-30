import type { FocusInterval, FocusSession } from "./types";

export type Totals = {
  focusMs: number;
  breakMs: number;
  elapsedMs: number;
  focusRatio: number;
  focusPeriods: number;
  longestFocusMs: number;
};

const ms = (value: string | Date | number) => new Date(value).getTime();

export function intervalDuration(interval: FocusInterval, nowMs = Date.now()) {
  const start = ms(interval.started_at);
  const end = interval.ended_at ? ms(interval.ended_at) : nowMs;
  return Math.max(0, end - start);
}

export function sessionTotals(session: FocusSession, nowMs = Date.now()): Totals {
  let focusMs = 0, breakMs = 0, longestFocusMs = 0, focusPeriods = 0;
  for (const interval of session.intervals ?? []) {
    const duration = intervalDuration(interval, nowMs);
    if (interval.kind === "focus") { focusMs += duration; longestFocusMs = Math.max(longestFocusMs, duration); focusPeriods += 1; }
    else breakMs += duration;
  }
  const elapsedMs = focusMs + breakMs;
  return { focusMs, breakMs, elapsedMs, focusRatio: elapsedMs ? (focusMs / elapsedMs) * 100 : 0, focusPeriods, longestFocusMs };
}

export function sessionsInRange(sessions: FocusSession[], start: Date, end: Date) {
  const startMs = start.getTime(), endMs = end.getTime();
  return sessions.filter((session) => { const t = ms(session.started_at); return t >= startMs && t < endMs; });
}

export function rangeTotals(sessions: FocusSession[], start: Date, end: Date, nowMs = Date.now()) {
  return sessionsInRange(sessions, start, end).reduce((acc, session) => {
    const totals = sessionTotals(session, nowMs);
    acc.focusMs += totals.focusMs; acc.breakMs += totals.breakMs; acc.elapsedMs += totals.elapsedMs;
    acc.longestFocusMs = Math.max(acc.longestFocusMs, totals.longestFocusMs); acc.sessions += 1;
    if (session.room_id) acc.sharedSessions += 1; else acc.soloSessions += 1;
    acc.focusBlocks += totals.focusPeriods; return acc;
  }, { focusMs: 0, breakMs: 0, elapsedMs: 0, longestFocusMs: 0, sessions: 0, soloSessions: 0, sharedSessions: 0, focusBlocks: 0 });
}

export function formatDuration(durationMs: number, compact = false) {
  const totalMinutes = Math.max(0, Math.floor(durationMs / 60_000));
  const hours = Math.floor(totalMinutes / 60), minutes = totalMinutes % 60;
  if (compact) { if (hours && minutes) return `${hours}h ${minutes}m`; if (hours) return `${hours}h`; return `${minutes}m`; }
  const seconds = Math.floor((Math.max(0, durationMs) % 60_000) / 1000);
  if (hours) return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function formatClock(durationMs: number) {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const hours = Math.floor(totalSeconds / 3600), minutes = Math.floor((totalSeconds % 3600) / 60), seconds = totalSeconds % 60;
  if (hours) return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function startOfDay(date = new Date()) { const d = new Date(date); d.setHours(0,0,0,0); return d; }
export function addDays(date: Date, days: number) { const d = new Date(date); d.setDate(d.getDate() + days); return d; }
export function startOfWeek(date = new Date()) { const d = startOfDay(date), day = d.getDay(); return addDays(d, day === 0 ? -6 : 1 - day); }
export function startOfMonth(date = new Date()) { return new Date(date.getFullYear(), date.getMonth(), 1); }
export function addMonths(date: Date, months: number) { return new Date(date.getFullYear(), date.getMonth() + months, 1); }
export function percent(value: number) { return `${Math.round(value)}%`; }
export function localDateKey(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`; }
