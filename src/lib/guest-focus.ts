export type GuestFocusMode = "open" | "25" | "50" | "90" | "custom";

export type GuestFocusDraft = {
  title: string;
  goals: string[];
  mode: GuestFocusMode;
  customMinutes: number;
  createdAt: number;
};

export const GUEST_FOCUS_DRAFT_KEY = "focus-lab:guest-focus-draft:v1";

export function normalizeGuestFocusDraft(value: unknown): GuestFocusDraft | null {
  if (!value || typeof value !== "object") return null;
  const draft = value as Partial<GuestFocusDraft>;
  const title = typeof draft.title === "string" ? draft.title.trim().slice(0, 160) : "";
  const goals = Array.isArray(draft.goals)
    ? draft.goals.filter((goal): goal is string => typeof goal === "string").map((goal) => goal.trim()).filter(Boolean).slice(0, 8)
    : [];
  const allowed = new Set<GuestFocusMode>(["open", "25", "50", "90", "custom"]);
  const mode = typeof draft.mode === "string" && allowed.has(draft.mode as GuestFocusMode) ? draft.mode as GuestFocusMode : "open";
  const customMinutes = Math.min(720, Math.max(1, Number(draft.customMinutes) || 60));
  if (!title) return null;
  return { title, goals, mode, customMinutes, createdAt: Number(draft.createdAt) || Date.now() };
}

export function readGuestFocusDraft(): GuestFocusDraft | null {
  if (typeof window === "undefined") return null;
  try {
    return normalizeGuestFocusDraft(JSON.parse(window.localStorage.getItem(GUEST_FOCUS_DRAFT_KEY) ?? "null"));
  } catch {
    return null;
  }
}

export function writeGuestFocusDraft(draft: GuestFocusDraft) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(GUEST_FOCUS_DRAFT_KEY, JSON.stringify(draft));
}

export function clearGuestFocusDraft() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(GUEST_FOCUS_DRAFT_KEY);
}

export function guestFocusDuration(draft: Pick<GuestFocusDraft, "mode" | "customMinutes">) {
  if (draft.mode === "open") return null;
  if (draft.mode === "custom") return Math.max(1, draft.customMinutes) * 60;
  return Number(draft.mode) * 60;
}

export function guestFocusModeLabel(draft: Pick<GuestFocusDraft, "mode" | "customMinutes">) {
  if (draft.mode === "open") return "Open-ended";
  if (draft.mode === "25") return "Pomodoro · 25/5";
  if (draft.mode === "custom") return `${draft.customMinutes} min`;
  return `${draft.mode} min`;
}
