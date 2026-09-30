import { describe, expect, it } from "vitest";
import { intervalDuration, rangeTotals, sessionTotals } from "../src/lib/metrics";
import type { FocusSession } from "../src/lib/types";

const session: FocusSession = {
  id: "s", user_id: "u", room_id: null, title: "Test", mode: "open", duration: null, status: "finished",
  started_at: "2026-09-29T18:00:00.000Z", finished_at: "2026-09-29T20:00:00.000Z", rating: null,
  goals: [],
  intervals: [
    { id:"1",session_id:"s",user_id:"u",kind:"focus",started_at:"2026-09-29T18:00:00.000Z",ended_at:"2026-09-29T18:50:00.000Z" },
    { id:"2",session_id:"s",user_id:"u",kind:"break",started_at:"2026-09-29T18:50:00.000Z",ended_at:"2026-09-29T19:10:00.000Z" },
    { id:"3",session_id:"s",user_id:"u",kind:"focus",started_at:"2026-09-29T19:10:00.000Z",ended_at:"2026-09-29T20:00:00.000Z" },
  ],
};

describe("focus metrics",()=>{
  it("calculates exact focus/break totals",()=>{
    const totals=sessionTotals(session);
    expect(totals.focusMs).toBe(100*60_000);
    expect(totals.breakMs).toBe(20*60_000);
    expect(totals.elapsedMs).toBe(120*60_000);
    expect(totals.focusRatio).toBeCloseTo(83.333,2);
    expect(totals.focusPeriods).toBe(2);
    expect(totals.longestFocusMs).toBe(50*60_000);
  });

  it("uses only the active break interval for a visible break timer",()=>{
    const activeBreak={id:"b",session_id:"s",user_id:"u",kind:"break" as const,started_at:"2026-09-29T20:00:00.000Z",ended_at:null};
    expect(intervalDuration(activeBreak,new Date("2026-09-29T20:06:30.000Z").getTime())).toBe(6.5*60_000);
  });

  it("aggregates sessions inside a requested range",()=>{
    const totals=rangeTotals([session],new Date("2026-09-29T00:00:00Z"),new Date("2026-09-30T00:00:00Z"));
    expect(totals.focusMs).toBe(100*60_000);
    expect(totals.breakMs).toBe(20*60_000);
    expect(totals.sessions).toBe(1);
  });
});
