import { describe, expect, it } from "vitest";
import { guestFocusDuration, guestFocusModeLabel, normalizeGuestFocusDraft } from "../src/lib/guest-focus";

describe("guest focus draft", () => {
  it("keeps only a valid, bounded focus plan", () => {
    const draft = normalizeGuestFocusDraft({
      title: "  Study chemistry  ",
      goals: [" Goal 1 ", "", "Goal 2", 5, ...Array.from({ length: 10 }, (_, i) => `Extra ${i}`)],
      mode: "custom",
      customMinutes: 900,
      createdAt: 123,
    });
    expect(draft?.title).toBe("Study chemistry");
    expect(draft?.goals).toHaveLength(8);
    expect(draft?.goals[0]).toBe("Goal 1");
    expect(draft?.customMinutes).toBe(720);
    expect(draft?.createdAt).toBe(123);
  });

  it("rejects drafts without a task", () => {
    expect(normalizeGuestFocusDraft({ title: "   ", goals: [], mode: "open", customMinutes: 60 })).toBeNull();
  });

  it("maps modes to the exact timer duration", () => {
    expect(guestFocusDuration({ mode: "open", customMinutes: 60 })).toBeNull();
    expect(guestFocusDuration({ mode: "25", customMinutes: 60 })).toBe(25 * 60);
    expect(guestFocusDuration({ mode: "custom", customMinutes: 42 })).toBe(42 * 60);
  });

  it("uses user-facing mode labels", () => {
    expect(guestFocusModeLabel({ mode: "25", customMinutes: 60 })).toBe("Pomodoro · 25/5");
    expect(guestFocusModeLabel({ mode: "custom", customMinutes: 42 })).toBe("42 min");
  });
});
