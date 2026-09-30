import { describe, expect, it } from "vitest";
import { sessionTotals } from "../src/lib/metrics";
import type { FocusSession } from "../src/lib/types";

describe("focus accounting", () => {
  it("keeps focus and breaks separate across several intervals", () => {
    const base = new Date("2026-09-29T19:00:00Z").getTime();
    const at = (minutes: number) => new Date(base + minutes * 60_000).toISOString();
    const session: FocusSession = {
      id: "session", user_id: "user", room_id: null, title: "Deterministic test", mode: "open", duration: null,
      status: "finished", started_at: at(0), finished_at: at(120), rating: null, goals: [],
      intervals: [
        { id: "a", session_id: "session", user_id: "user", kind: "focus", started_at: at(0), ended_at: at(50) },
        { id: "b", session_id: "session", user_id: "user", kind: "break", started_at: at(50), ended_at: at(70) },
        { id: "c", session_id: "session", user_id: "user", kind: "focus", started_at: at(70), ended_at: at(120) },
      ],
    };
    const totals = sessionTotals(session, base + 120 * 60_000);
    expect(totals.focusMs).toBe(100 * 60_000);
    expect(totals.breakMs).toBe(20 * 60_000);
    expect(totals.elapsedMs).toBe(120 * 60_000);
    expect(totals.focusRatio).toBeCloseTo(83.3333, 3);
    expect(totals.focusPeriods).toBe(2);
  });
});
