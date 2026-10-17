"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowRight, BarChart3, Check, Clock3, LockKeyhole, Plus, Target, Users } from "lucide-react";
import { Brand } from "@/components/brand";
import { clearGuestFocusDraft, guestFocusModeLabel, readGuestFocusDraft, writeGuestFocusDraft, type GuestFocusDraft, type GuestFocusMode } from "@/lib/guest-focus";

const parseGoals = (value: string) => value.split("\n").map((goal) => goal.trim()).filter(Boolean).slice(0, 8);

export function GuestHome() {
  const [title, setTitle] = useState("");
  const [goalsText, setGoalsText] = useState("");
  const [mode, setMode] = useState<GuestFocusMode>("open");
  const [customMinutes, setCustomMinutes] = useState(60);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const existing = readGuestFocusDraft();
    if (existing) {
      setTitle(existing.title);
      setGoalsText(existing.goals.join("\n"));
      setMode(existing.mode);
      setCustomMinutes(existing.customMinutes);
    }
    setLoaded(true);
  }, []);

  const goals = useMemo(() => parseGoals(goalsText), [goalsText]);
  const draft: GuestFocusDraft = {
    title: title.trim(),
    goals,
    mode,
    customMinutes,
    createdAt: Date.now(),
  };
  const modeLabel = guestFocusModeLabel(draft);

  useEffect(() => {
    if (!loaded) return;
    if (!title.trim()) {
      clearGuestFocusDraft();
      return;
    }
    writeGuestFocusDraft(draft);
  }, [loaded, title, goalsText, mode, customMinutes]);

  function start(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    writeGuestFocusDraft(draft);
    window.location.assign("/start");
  }

  return <div className="guest-shell" id="top">
    <header className="guest-nav">
      <div className="lab-container guest-nav-inner">
        <Brand compact />
        <div className="guest-nav-actions">
          <a href="#how-it-works" className="guest-nav-link">How it works</a>
          <Link href="/login" className="btn btn-ghost btn-small">Sign in</Link>
        </div>
      </div>
    </header>

    <main className="guest-main">
      <div className="lab-container">
        <section className="guest-hero">
          <div className="guest-hero-copy">
            <p className="eyebrow">TRY THE PRODUCT BEFORE YOU SIGN UP</p>
            <h1>Focus that tells the truth.</h1>
            <p className="lead">Plan what you’re about to do, track actual work separately from breaks, and stay accountable with friends when you want to.</p>
            <div className="guest-trust-row">
              <span><LockKeyhole size={14}/>Private by default</span>
              <span><Check size={14}/>Free to start</span>
              <span><Users size={14}/>Focus with up to 5 friends</span>
            </div>
          </div>

          <form className="panel guest-builder" onSubmit={start}>
            <div className="guest-builder-head">
              <div>
                <p className="eyebrow">YOUR FIRST FOCUS</p>
                <h2>What are you working on?</h2>
              </div>
              <Target className="muted" size={22}/>
            </div>

            <label className="field">
              <span>Focus on</span>
              <input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Finish my chemistry notes"
                maxLength={160}
                required
              />
            </label>

            <label className="field">
              <span>Goals · optional · one per line</span>
              <textarea
                value={goalsText}
                onChange={(e) => setGoalsText(e.target.value)}
                placeholder={"Read section 3\nFinish practice questions\nWrite summary"}
              />
            </label>

            {goals.length > 0 && <div className="guest-goal-preview">
              {goals.map((goal, index) => <div key={`${goal}-${index}`}><span>{index + 1}</span><b>{goal}</b></div>)}
            </div>}

            <div>
              <div className="text-xs muted font-bold mb-2">Focus mode</div>
              <div className="segmented guest-modes">
                {([
                  ["open", "Open-ended"],
                  ["25", "Pomodoro · 25/5"],
                  ["50", "50 min"],
                  ["90", "90 min"],
                  ["custom", "Custom"],
                ] as Array<[GuestFocusMode, string]>).map(([value, label]) => (
                  <button type="button" key={value} onClick={() => setMode(value)} className={mode === value ? "active" : ""}>{label}</button>
                ))}
              </div>
            </div>

            {mode === "custom" && <label className="field guest-custom-minutes"><span>Minutes</span><input type="number" min={1} max={720} value={customMinutes} onChange={(e) => setCustomMinutes(Number(e.target.value))}/></label>}

            <div className="guest-ready-card">
              <div><span>Session</span><b>{title.trim() || "Your focus session"}</b></div>
              <div><span>Mode</span><b>{modeLabel}</b></div>
              <div><span>Goals</span><b>{goals.length || "Optional"}</b></div>
            </div>

            <button className="btn btn-primary guest-start-btn" disabled={!title.trim()} type="submit">
              Start focus <ArrowRight size={17}/>
            </button>
            <p className="guest-gate-note">No account needed to plan this. You’ll create a free account only when you start, so your timer and stats can be saved.</p>
          </form>
        </section>

        <section className="guest-product-strip" id="how-it-works">
          <div className="guest-product-card"><Clock3/><div><b>Track real work</b><span>Focus and breaks are recorded separately.</span></div></div>
          <div className="guest-product-card"><BarChart3/><div><b>See actual progress</b><span>Know where your time really went.</span></div></div>
          <div className="guest-product-card"><Users/><div><b>Work beside friends</b><span>Shared rooms, video, chat, tasks, and screen share when you need accountability.</span></div></div>
        </section>

        <section className="guest-how">
          <div><span>1</span><b>Plan it</b><p>Write what you’re doing and the next few actions.</p></div>
          <div><span>2</span><b>Start it</b><p>Create your free account only when you’re ready to begin.</p></div>
          <div><span>3</span><b>See the truth</b><p>Focus, take honest breaks, finish, and see the time you actually put in.</p></div>
        </section>

        <section className="guest-final-cta panel">
          <div><p className="eyebrow">NO LOGIN WALL</p><h2>Set up your session first.</h2><p className="muted">Decide whether Focus Lab is useful before giving it your email.</p></div>
          <a className="btn btn-primary" href="#top" onClick={(e)=>{e.preventDefault();window.scrollTo({top:0,behavior:"smooth"})}}>Plan a focus session <Plus size={16}/></a>
        </section>
      </div>
    </main>
  </div>;
}
