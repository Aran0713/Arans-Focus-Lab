"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Coffee,
  Flag,
  GripVertical,
  LayoutGrid,
  LogOut,
  MessageCircle,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Save,
  Target,
  Trash2,
  Users,
  Video as VideoIcon,
  X,
} from "lucide-react";
import { useLab } from "@/components/lab-provider";
import { VideoPanel } from "@/components/video-panel";
import { RoomChat } from "@/components/room-chat";
import { formatClock, formatDuration, intervalDuration, sessionTotals } from "@/lib/metrics";
import type { FocusRoom, FocusSession, RoomMember, ScheduledSession, SharedGoal } from "@/lib/types";

const parseGoals = (value: string) => value.split("\n").map((v) => v.trim()).filter(Boolean).slice(0, 8);

function GoalDraftPreview({ value }: { value: string }) {
  const goals = parseGoals(value);
  return (
    <div className="goal-draft-preview">
      <div className="goal-draft-caption">Each new line becomes its own checkbox in the session.</div>
      {goals.length ? (
        <div className="goal-draft-list">
          {goals.map((goal, index) => <div className="goal-draft-item" key={`${goal}-${index}`}><span>{index + 1}</span><b>{goal}</b></div>)}
        </div>
      ) : <div className="goal-draft-empty">Type Goal 1, press Enter, then type Goal 2.</div>}
    </div>
  );
}

function PartnerPicker({ selected, onToggle }: { selected: string[]; onToggle: (id: string) => void }) {
  const { state, partnerOnline } = useLab();
  const partners = state?.partners ?? [];
  return (
    <div>
      <div className="text-xs muted font-bold mb-2">Invite partners · up to 5</div>
      <div className="partner-picker">
        {partners.map((partner) => (
          <button type="button" key={partner.id} className={selected.includes(partner.id) ? "selected" : ""} onClick={() => onToggle(partner.id)}>
            <span className={`status-dot ${partnerOnline[partner.id] ? "" : "offline"}`} />
            {partner.name}
            {selected.includes(partner.id) && <Check size={14} />}
          </button>
        ))}
      </div>
    </div>
  );
}

function SessionSetup({ shared = false, schedule }: { shared?: boolean; schedule?: ScheduledSession | null }) {
  const { state, user, command, busy, broadcast } = useLab();
  const settings = state?.profile?.settings;
  const scheduledMinutes = schedule?.duration ? Math.round(schedule.duration / 60) : null;
  const schedulePartners = useMemo(() => schedule?.members.filter((m) => m.id !== user?.id).map((m) => m.id) ?? [], [schedule, user?.id]);
  const [title, setTitle] = useState(schedule?.title ?? "");
  const [goalsText, setGoalsText] = useState("");
  const initialMode = schedule
    ? (scheduledMinutes === 25 ? "25" : scheduledMinutes === 50 ? "50" : scheduledMinutes === 90 ? "90" : "custom")
    : (settings?.focusDefault ?? "open");
  const [mode, setMode] = useState(String(initialMode));
  const [custom, setCustom] = useState(scheduledMinutes && ![25, 50, 90].includes(scheduledMinutes) ? scheduledMinutes : (settings?.customMinutes ?? 60));
  const [selectedPartners, setSelectedPartners] = useState<string[]>(schedulePartners.length ? schedulePartners : (state?.partners?.length === 1 ? [state.partners[0].id] : []));

  useEffect(() => {
    if (schedule) {
      setTitle(schedule.title);
      setSelectedPartners(schedulePartners);
    }
  }, [schedule?.id, schedule?.title, schedulePartners]);

  if (!state) return null;
  const duration = mode === "open" ? null : mode === "custom" ? Math.max(1, custom) * 60 : Number(mode) * 60;
  const goals = parseGoals(goalsText);
  const allScheduledCommitted = schedule ? schedule.members.length > 0 && schedule.rsvps.length === schedule.members.length : true;

  function togglePartner(id: string) {
    setSelectedPartners((current) => current.includes(id) ? current.filter((v) => v !== id) : current.length < 5 ? [...current, id] : current);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    if (shared) {
      if (selectedPartners.length === 0 || !allScheduledCommitted) return;
      const result = await command("create_room", { duration, title: title.trim(), goals, partner_ids: selectedPartners });
      await broadcast("focus_invite", { title: title.trim(), partner_ids: selectedPartners, room_id: result?.room_id });
    } else {
      await command("start", { title: title.trim(), duration, goals });
    }
  }

  return (
    <section className="panel p-6 sm:p-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="eyebrow">{shared ? "SHARED FOCUS" : "SOLO FOCUS"}</p>
          <h2 className="text-3xl font-extrabold tracking-[-.04em] mt-2">{schedule ? "Your scheduled session is ready." : "What are you working on?"}</h2>
          {schedule && <p className="muted text-sm mt-2">{new Date(schedule.scheduled_for).toLocaleString()} · {schedule.rsvps.length}/{schedule.members.length} committed</p>}
        </div>
        {shared ? <Users className="muted" /> : <Play className="muted" />}
      </div>
      <form onSubmit={submit} className="mt-7 space-y-5">
        <label className="field"><span>Focus on</span><input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nanomaterials paper" maxLength={160} required /></label>
        <label className="field"><span>Goals for this session · press Enter for the next goal</span><textarea value={goalsText} onChange={(e) => setGoalsText(e.target.value)} placeholder={"Understand Figure 3\nWrite methods notes\nDraft conclusion"} /></label>
        <GoalDraftPreview value={goalsText} />
        {shared && !schedule && <PartnerPicker selected={selectedPartners} onToggle={togglePartner} />}
        {shared && schedule && <div className="info-box">Room: {schedule.members.filter((m) => m.id !== user?.id).map((m) => m.name).join(", ")}{!allScheduledCommitted && " · Waiting for every invitee to RSVP."}</div>}
        <div>
          <div className="text-xs muted font-bold mb-2">Mode</div>
          <div className="segmented">
            {[["open", "Open-ended"], ["25", "Pomodoro · 25/5"], ["50", "50 min"], ["90", "90 min"], ["custom", "Custom"]].map(([value, label]) => (
              <button type="button" key={value} onClick={() => setMode(value)} className={mode === value ? "active" : ""}>{label}</button>
            ))}
          </div>
        </div>
        {mode === "custom" && <label className="field max-w-[180px]"><span>Minutes</span><input type="number" min={1} max={720} value={custom} onChange={(e) => setCustom(Number(e.target.value))} /></label>}
        {mode === "25" && <div className="info-box">Pomodoro repeats 25-minute focus rounds with 5-minute break targets while actual focus and break time stay recorded separately.</div>}
        <button className="btn btn-primary" disabled={busy || !title.trim() || (shared && selectedPartners.length === 0) || (shared && !allScheduledCommitted)}>{busy ? "Starting…" : shared ? "Create shared room" : "Start Focus"}</button>
      </form>
    </section>
  );
}

function WaitingRoom() {
  const { state, user, command, busy, broadcast } = useLab();
  const room = state?.room;
  if (!room || room.status !== "waiting") return null;
  const roomId = room.id;
  const me = room.members.find((m) => m.user_id === user?.id);
  const presentMembers = room.members.filter((m) => m.is_present);
  const [title, setTitle] = useState(me?.title ?? "");
  const [goalsText, setGoalsText] = useState(Array.isArray(me?.goals) ? me.goals.join("\n") : "");
  const goals = parseGoals(goalsText);
  const isCreator = room.created_by === user?.id;

  async function saveDraft() {
    if (!me || !title.trim()) return;
    await command("room_member_update", { room_id: roomId, title: title.trim(), goals });
    await broadcast("state_changed", { room_id: roomId });
  }

  async function ready() {
    if (!me || !title.trim()) return;
    await command("ready", { room_id: roomId, title: title.trim(), goals });
  }

  return (
    <section className="panel p-6 sm:p-8">
      <div className="flex items-start justify-between gap-5">
        <div>
          <p className="eyebrow">SHARED ROOM</p>
          <h2 className="text-3xl font-extrabold mt-2">Get ready, then focus together.</h2>
          <p className="muted mt-2">You can leave at any time. The invite stays available so you can come back while the room is still open.</p>
        </div>
        <span className="kbd-pill">{presentMembers.filter((m) => m.ready).length}/{presentMembers.length} here ready</span>
      </div>
      <div className="waiting-grid mt-7">
        {room.members.map((member) => member.user_id === user?.id ? (
          <div className="participant-card mine" key={member.user_id}>
            <ParticipantHead member={member} you />
            <label className="field mt-4"><span>Working on</span><input value={title} onChange={(e) => setTitle(e.target.value)} disabled={member.ready} /></label>
            <label className="field mt-4"><span>Goals for this session · one goal per line</span><textarea value={goalsText} onChange={(e) => setGoalsText(e.target.value)} disabled={member.ready} /></label>
            {!member.ready && <GoalDraftPreview value={goalsText} />}
            <div className="flex gap-2 mt-4 flex-wrap">
              {!member.ready && <button className="btn btn-ghost" disabled={busy || !title.trim()} onClick={saveDraft}>Save draft</button>}
              <button className="btn btn-primary" disabled={busy || member.ready || !title.trim()} onClick={ready}>{member.ready ? "Ready ✓" : "I’m ready"}</button>
            </div>
          </div>
        ) : <WaitingMemberCard member={member} key={member.user_id} />)}
      </div>
      <div className="info-box mt-5">No camera yet — video becomes available once the shared focus session starts.</div>
      <div className="flex gap-3 mt-5 flex-wrap">
        <button className="btn btn-secondary" disabled={busy} onClick={() => command("leave_room", { room_id: roomId })}><LogOut size={16} />Leave room</button>
        {isCreator && <button className="btn btn-ghost" disabled={busy} onClick={() => command("cancel_room", { room_id: roomId })}>Cancel room for everyone</button>}
      </div>
    </section>
  );
}

function WaitingMemberCard({ member }: { member: RoomMember }) {
  const goals = Array.isArray(member.goals) ? member.goals : [];
  return (
    <div className={`participant-card ${member.is_present ? "" : "finished"}`}>
      <ParticipantHead member={member} />
      <div className="mt-5 text-xl font-bold">{member.title || (member.is_present ? "Waiting for their plan…" : "Invite is open")}</div>
      {goals.length ? (
        <div className="goals mt-4">{goals.map((goal, index) => <div className="goal" key={`${goal}-${index}`}><span className="goal-bullet" /><span className="goal-text">{goal}</span></div>)}</div>
      ) : <p className="muted text-sm mt-3">{member.is_present ? "Their shared-session goals will appear here." : "They can join this room whenever they’re ready."}</p>}
    </div>
  );
}

function ParticipantHead({ member, you = false }: { member: RoomMember; you?: boolean }) {
  const label = !member.is_present ? "Away" : member.ready ? "Ready" : "Not ready";
  const statusClass = !member.is_present ? "waiting" : member.ready ? "ready" : "waiting";
  return <div className="flex items-center justify-between gap-3"><div className="font-extrabold">{you ? "You" : member.name}</div><span className={`room-status ${statusClass}`}>{label}</span></div>;
}

function sessionStatus(member: RoomMember) {
  if (!member.is_present) return "Away";
  if (!member.session) return member.ready ? "Ready" : "Waiting";
  if (member.session.status === "break") return "On break";
  if (member.session.status === "finished") return "Finished";
  return "Focusing";
}

function EditableGoals({ session, compact = false }: { session: FocusSession; compact?: boolean }) {
  const { command, busy } = useLab();
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const goals = [...session.goals].sort((a, b) => a.position - b.position);

  async function add() {
    const text = draft.trim();
    if (!text || goals.length >= 8) return;
    await command("add_goal", { session_id: session.id, text });
    setDraft("");
  }
  async function save(id: string) {
    const text = editingText.trim();
    if (!text) return;
    await command("update_goal", { goal_id: id, text });
    setEditingId(null);
    setEditingText("");
  }
  async function remove(id: string) {
    await command("delete_goal", { goal_id: id });
    if (editingId === id) { setEditingId(null); setEditingText(""); }
  }
  async function reorder(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const from = goals.findIndex((g) => g.id === dragId), to = goals.findIndex((g) => g.id === targetId);
    if (from < 0 || to < 0) return;
    const next = [...goals];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setDragId(null);
    await command("reorder_goals", { goal_ids: next.map((g) => g.id) });
  }
  async function shift(id: string, direction: -1 | 1) {
    const from = goals.findIndex((g) => g.id === id), to = from + direction;
    if (from < 0 || to < 0 || to >= goals.length) return;
    const next = [...goals];
    [next[from], next[to]] = [next[to], next[from]];
    await command("reorder_goals", { goal_ids: next.map((g) => g.id) });
  }

  return (
    <div className={compact ? "" : "mt-4"}>
      <div className="goals">
        {goals.map((goal, index) => (
          <div className={`goal editable-goal ${goal.completed ? "done" : ""}`} key={goal.id} draggable={!editingId} onDragStart={() => setDragId(goal.id)} onDragOver={(e) => e.preventDefault()} onDrop={() => reorder(goal.id)}>
            <div className="mobile-reorder" aria-label="Reorder goal">
              <button type="button" aria-label="Move goal up" disabled={busy || Boolean(editingId) || index === 0} onClick={() => shift(goal.id, -1)}><ChevronUp size={13} /></button>
              <button type="button" aria-label="Move goal down" disabled={busy || Boolean(editingId) || index === goals.length - 1} onClick={() => shift(goal.id, 1)}><ChevronDown size={13} /></button>
            </div>
            <GripVertical size={15} className="drag-handle" aria-hidden="true" />
            <button disabled={busy || editingId === goal.id} onClick={() => command("goal", { goal_id: goal.id, completed: !goal.completed })}>{goal.completed ? <Check size={14} /> : null}</button>
            {editingId === goal.id ? (
              <input className="inline-edit" autoFocus value={editingText} maxLength={200} onChange={(e) => setEditingText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); save(goal.id); } if (e.key === "Escape") { setEditingId(null); setEditingText(""); } }} />
            ) : <span className="goal-text flex-1">{goal.text}</span>}
            <div className="goal-actions">
              {editingId === goal.id ? <>
                <button className="icon-btn" aria-label="Save goal" onClick={() => save(goal.id)} disabled={!editingText.trim() || busy}><Save size={14} /></button>
                <button className="icon-btn" aria-label="Cancel edit" onClick={() => { setEditingId(null); setEditingText(""); }}><X size={14} /></button>
              </> : <>
                <button className="icon-btn" aria-label="Edit goal" disabled={busy} onClick={() => { setEditingId(goal.id); setEditingText(goal.text); }}><Pencil size={13} /></button>
                <button className="icon-btn danger" aria-label="Delete goal" disabled={busy} onClick={() => remove(goal.id)}><Trash2 size={13} /></button>
              </>}
            </div>
          </div>
        ))}
      </div>
      {goals.length < 8 && <div className="flex gap-2 mt-3"><input className="inline-add" value={draft} maxLength={200} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} placeholder="Add a goal during the session" /><button className="btn btn-ghost btn-small" disabled={busy || !draft.trim()} onClick={add}><Plus size={14} />Add</button></div>}
    </div>
  );
}

function ReadOnlyGoals({ goals }: { goals: SharedGoal[] }) {
  const ordered = [...goals].sort((a, b) => a.position - b.position);
  return <div className="goals mt-4">{ordered.length ? ordered.map((goal) => <div className={`goal ${goal.completed ? "done" : ""}`} key={goal.id}><span className="w-[19px] h-[19px] grid place-items-center">{goal.completed ? <Check size={14} /> : null}</span><span className="goal-text">{goal.text}</span></div>) : <div className="text-sm muted">No goals added yet.</div>}</div>;
}

function SharedGoalsBoard({ room, session }: { room: FocusRoom; session: FocusSession }) {
  return (
    <section className="panel p-6 mt-5">
      <div className="flex items-start justify-between gap-4"><div><p className="eyebrow">SHARED GOALS</p><h2 className="section-title mt-2">Work separately. Stay accountable together.</h2></div><span className="kbd-pill">{room.members.filter((m) => m.is_present).length} here</span></div>
      <div className="room-goals-grid mt-5">
        {room.members.filter((m) => m.is_present).map((member) => member.user_id === session.user_id ? (
          <div className="participant-card mine" key={member.user_id}><div className="flex justify-between gap-3"><div><div className="font-extrabold">You</div><div className="text-sm muted mt-1">{session.title}</div></div><span className={`room-status ${session.status}`}>{sessionStatus(member)}</span></div><EditableGoals session={session} /></div>
        ) : (
          <div className={`participant-card ${member.session?.status === "finished" ? "finished" : ""}`} key={member.user_id}><div className="flex justify-between gap-3"><div><div className="font-extrabold">{member.name}</div><div className="text-sm muted mt-1">{member.session?.title || member.title || "Waiting"}</div></div><span className={`room-status ${member.session?.status ?? "waiting"}`}>{sessionStatus(member)}</span></div><ReadOnlyGoals goals={member.session?.goals ?? []} /></div>
        ))}
      </div>
    </section>
  );
}

function SessionSummary({ session, onDone, onAnother, onRejoin }: { session: FocusSession; onDone: () => void | Promise<void>; onAnother: () => void | Promise<void>; onRejoin?: () => void | Promise<void> }) {
  const { command, busy } = useLab();
  const totals = sessionTotals(session, session.finished_at ? new Date(session.finished_at).getTime() : Date.now());
  const completed = session.goals.filter((g) => g.completed).length;
  return (
    <section className="panel p-7 sm:p-10 text-center">
      <p className="eyebrow">SESSION COMPLETE</p>
      <h2 className="text-4xl sm:text-5xl font-extrabold mt-3">You showed up.</h2>
      <p className="lead mt-2">Here’s what actually happened.</p>
      <div className="grid-3 mt-7 text-left"><div className="stat"><div className="stat-label">Total elapsed</div><div className="stat-value">{formatDuration(totals.elapsedMs, true)}</div></div><div className="stat"><div className="stat-label">Focused</div><div className="stat-value">{formatDuration(totals.focusMs, true)}</div></div><div className="stat"><div className="stat-label">Breaks</div><div className="stat-value">{formatDuration(totals.breakMs, true)}</div></div></div>
      <div className="grid-3 mt-3 text-left"><div className="stat"><div className="stat-label">Focus ratio</div><div className="stat-value">{Math.round(totals.focusRatio)}%</div></div><div className="stat"><div className="stat-label">Focus periods</div><div className="stat-value">{totals.focusPeriods}</div></div><div className="stat"><div className="stat-label">Goals</div><div className="stat-value">{completed}/{session.goals.length}</div></div></div>
      {session.goals.length > 0 && <div className="goals mt-6 max-w-xl mx-auto">{session.goals.map((g) => <div key={g.id} className={`goal ${g.completed ? "done" : ""}`}><span className="w-[19px] h-[19px] grid place-items-center">{g.completed ? <Check size={15} /> : null}</span><span className="goal-text">{g.text}</span></div>)}</div>}
      <div className="mt-7"><div className="text-xs muted font-bold mb-3">How did that session feel?</div><div className="segmented justify-center">{([[1, "Poor"], [2, "Okay"], [3, "Good"], [4, "Great"]] as const).map(([value, label]) => <button key={value} disabled={busy} className={session.rating === value ? "active" : ""} onClick={() => command("rate", { session_id: session.id, rating: value })}>{label}</button>)}</div></div>
      {onRejoin && <div className="info-box mt-6 text-left"><b>Want to keep going?</b> Rejoin the shared room and this same session continues. Your focus time and goals stay intact.</div>}
      <div className="flex flex-wrap justify-center gap-3 mt-7">
        {onRejoin && <button className="btn btn-primary" disabled={busy} onClick={onRejoin}><RotateCcw size={16} />Rejoin shared focus</button>}
        <button className={onRejoin ? "btn btn-secondary" : "btn btn-primary"} disabled={busy} onClick={onDone}>Done</button>
        <button className="btn btn-secondary" disabled={busy} onClick={onAnother}>Start Another</button>
      </div>
    </section>
  );
}

function memberFocusMs(member: RoomMember, now: number) {
  const session = member.session;
  if (!session) return 0;
  let ms = Math.max(0, Number(session.focus_seconds ?? 0)) * 1000;
  if (session.status === "focusing" && session.interval_started_at) {
    ms += Math.max(0, now - new Date(session.interval_started_at).getTime());
  }
  return ms;
}

function SharedFocusWorkspace({ session, room, onFinished }: { session: FocusSession; room: FocusRoom; onFinished: (id: string) => void }) {
  const { user, command, busy, serverNow } = useLab();
  const [now, setNow] = useState(serverNow());
  const [showVideo, setShowVideo] = useState(true);
  const [showSidebar, setShowSidebar] = useState(true);
  const [chatUnread, setChatUnread] = useState(0);
  const [layoutLoaded, setLayoutLoaded] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(serverNow()), 1000);
    return () => clearInterval(timer);
  }, [serverNow]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("focus-room-layout:v2") ?? window.localStorage.getItem("focus-room-layout:v1");
      if (saved) {
        const parsed = JSON.parse(saved) as { video?: boolean; sidebar?: boolean; goals?: boolean; chat?: boolean };
        if (typeof parsed.video === "boolean") setShowVideo(parsed.video);
        if (typeof parsed.sidebar === "boolean") setShowSidebar(parsed.sidebar);
        else if (typeof parsed.chat === "boolean" || typeof parsed.goals === "boolean") setShowSidebar(parsed.chat !== false || parsed.goals !== false);
      }
    } catch {}
    setLayoutLoaded(true);
  }, []);

  useEffect(() => {
    if (!layoutLoaded) return;
    try {
      window.localStorage.setItem("focus-room-layout:v2", JSON.stringify({ video: showVideo, sidebar: showSidebar }));
      window.localStorage.removeItem("focus-room-layout:v1");
    } catch {}
  }, [layoutLoaded, showSidebar, showVideo]);

  const totals = useMemo(() => sessionTotals(session, now), [session, now]);
  const isBreak = session.status === "break";
  const activeInterval = [...(session.intervals ?? [])].reverse().find((i) => !i.ended_at);
  const currentIntervalMs = activeInterval ? intervalDuration(activeInterval, now) : 0;
  const isPomodoro = session.mode === "timed" && session.duration === 25 * 60;
  const remaining = session.duration ? Math.max(0, session.duration * 1000 - totals.focusMs) : null;
  const pomodoroRemaining = isPomodoro && !isBreak ? Math.max(0, 25 * 60 * 1000 - currentIntervalMs) : null;
  const displayed = isBreak ? currentIntervalMs : isPomodoro && pomodoroRemaining !== null ? pomodoroRemaining : session.mode === "timed" && remaining !== null ? remaining : totals.focusMs;
  const presentMembers = room.members.filter((member) => member.is_present);
  const otherNames = presentMembers.filter((member) => member.user_id !== user?.id).map((member) => member.name);
  const roomTitle = otherNames.length ? `Focus with ${otherNames.join(", ")}` : "Shared focus";
  const isCreator = room.created_by === user?.id;

  async function finish() {
    await command("finish", { session_id: session.id });
    onFinished(session.id);
  }

  async function leaveRoom() {
    await command("leave_room", { room_id: room.id });
  }

  return (
    <section className={`focus-workspace-shell ${showSidebar ? "" : "panel-closed"}`}>
      <header className="focus-workspace-head">
        <div className="focus-workspace-title">
          <p className="eyebrow">SHARED FOCUS</p>
          <h1>{roomTitle}</h1>
          <div><span className="status-dot" />{presentMembers.length} {presentMembers.length === 1 ? "person" : "people"} here · Your focus: {session.title}</div>
        </div>

        <div className="workspace-member-timers">
          {presentMembers.map((member) => (
            <div className={`workspace-member-timer ${member.user_id === user?.id ? "mine" : ""}`} key={member.user_id}>
              <span className="workspace-member-avatar">{member.user_id === user?.id ? "You" : member.name.split(/\s+/).map((part) => part[0]).slice(0,2).join("").toUpperCase()}</span>
              <span><b>{member.user_id === user?.id ? "You" : member.name}</b><small className={member.session?.status === "break" ? "break" : member.session?.status === "finished" ? "finished" : ""}>{sessionStatus(member)}</small></span>
              <strong>{formatClock(memberFocusMs(member, now))}</strong>
            </div>
          ))}
        </div>

        <details className="workspace-layout-menu">
          <summary><LayoutGrid size={16} />Layout</summary>
          <div className="workspace-layout-popover">
            <div className="workspace-layout-label">SHOW IN WORKSPACE</div>
            <button type="button" className={showVideo ? "active" : ""} onClick={() => setShowVideo((value) => !value)}><VideoIcon size={15} /><span>Video</span><b>{showVideo ? "On" : "Off"}</b></button>
            <button type="button" className={showSidebar ? "active" : ""} onClick={() => setShowSidebar((value) => !value)}><Target size={15} /><span>Tasks / Chat</span><b>{showSidebar ? "On" : chatUnread ? `${chatUnread} new` : "Off"}</b></button>
            <div className="workspace-layout-divider" />
            <button type="button" className="workspace-layout-action" disabled={busy} onClick={leaveRoom}><LogOut size={15} /><span>Leave shared room</span></button>
            {isCreator && <button type="button" className="workspace-layout-action danger" disabled={busy} onClick={() => command("cancel_room", { room_id: room.id })}><X size={15} /><span>End room for everyone</span></button>}
          </div>
        </details>
      </header>

      <div className="focus-workspace-body">
        <div className="focus-workspace-main">
          <div className="workspace-video-wrap">
            <VideoPanel roomId={room.id} embedded collapsed={!showVideo} onExpand={() => setShowVideo(true)} />
          </div>
        </div>

        <aside className={`focus-workspace-chat ${showSidebar ? "" : "is-hidden"}`}>
          <RoomChat
            room={room}
            visible={showSidebar}
            onClose={() => setShowSidebar(false)}
            onUnreadChange={setChatUnread}
            tasksSlot={
              <div className="sidebar-task-content">
                <div className="sidebar-task-intro">
                  <p className="eyebrow">WHAT WE’RE WORKING ON</p>
                  <span>Keep the next actions visible. Check them off as you go.</span>
                </div>
                {presentMembers.map((member) => member.user_id === session.user_id ? (
                  <div className="sidebar-task-person mine" key={member.user_id}>
                    <div className="workspace-goal-person-head"><span><b>You</b><small>{session.title}</small></span><span className={`room-status ${session.status}`}>{sessionStatus(member)}</span></div>
                    <EditableGoals session={session} compact />
                  </div>
                ) : (
                  <div className={`sidebar-task-person ${member.session?.status === "finished" ? "finished" : ""}`} key={member.user_id}>
                    <div className="workspace-goal-person-head"><span><b>{member.name}</b><small>{member.session?.title || member.title || "Shared focus"}</small></span><span className={`room-status ${member.session?.status ?? "waiting"}`}>{sessionStatus(member)}</span></div>
                    <ReadOnlyGoals goals={member.session?.goals ?? []} />
                  </div>
                ))}
              </div>
            }
          />
        </aside>
      </div>

      <footer className="focus-workspace-controls">
        <div className="workspace-quick-actions">
          {!showSidebar && <button type="button" onClick={() => setShowSidebar(true)}><Target size={17} />Tasks / Chat{chatUnread > 0 && <span>{chatUnread > 9 ? "9+" : chatUnread}</span>}</button>}
          {!showVideo && <button type="button" onClick={() => setShowVideo(true)}><VideoIcon size={17} />Video</button>}
        </div>
        <div className={`workspace-main-timer ${isBreak ? "break" : ""}`}>
          <strong>{formatClock(displayed)}</strong>
          <span>{isBreak ? `Break timer · Focused ${formatClock(totals.focusMs)}` : isPomodoro ? "Pomodoro focus" : "Focused time"}</span>
        </div>
        <div className="workspace-timer-actions">
          {isBreak ? <button className="btn btn-primary" disabled={busy} onClick={() => command("resume", { session_id: session.id })}><RotateCcw size={16} />Resume</button> : <button className="btn btn-secondary" disabled={busy} onClick={() => command("break", { session_id: session.id })}><Coffee size={16} />Break</button>}
          <button className="btn btn-ghost workspace-finish" disabled={busy} onClick={finish}><Flag size={16} />Finish</button>
        </div>
      </footer>
    </section>
  );
}

function ActiveTimer({ session, onFinished }: { session: FocusSession; onFinished: (id: string) => void }) {
  const { state, command, busy, serverNow } = useLab();
  const [now, setNow] = useState(serverNow());
  useEffect(() => { const timer = window.setInterval(() => setNow(serverNow()), 1000); return () => clearInterval(timer); }, [serverNow]);
  const room = session.room_id && state?.room?.id === session.room_id ? state.room : null;
  const totals = useMemo(() => sessionTotals(session, now), [session, now]);

  if (room) return <SharedFocusWorkspace session={session} room={room} onFinished={onFinished} />;
  const isBreak = session.status === "break";
  const activeInterval = [...(session.intervals ?? [])].reverse().find((i) => !i.ended_at);
  const currentIntervalMs = activeInterval ? intervalDuration(activeInterval, now) : 0;
  const isPomodoro = session.mode === "timed" && session.duration === 25 * 60;
  const remaining = session.duration ? Math.max(0, session.duration * 1000 - totals.focusMs) : null;
  const pomodoroRemaining = isPomodoro && !isBreak ? Math.max(0, 25 * 60 * 1000 - currentIntervalMs) : null;
  const displayed = isBreak ? totals.focusMs : isPomodoro && pomodoroRemaining !== null ? pomodoroRemaining : session.mode === "timed" && remaining !== null ? remaining : totals.focusMs;
  const breakMs = isBreak && activeInterval?.kind === "break" ? currentIntervalMs : 0;
  const pomodoroBreakRemaining = isPomodoro && isBreak ? Math.max(0, 5 * 60 * 1000 - breakMs) : null;

  async function finish() { await command("finish", { session_id: session.id }); onFinished(session.id); }

  return <>
    <section className={`panel timer-screen ${isBreak ? "break-mode" : ""}`}>
      <div><div className="timer-label">{isBreak ? "BREAK" : isPomodoro ? `POMODORO · ROUND ${Math.max(1, totals.focusPeriods)}` : "FOCUS"}</div><div className="mt-3 text-xl font-bold">{session.title}</div></div>
      <div><div className="timer-clock">{formatClock(displayed)}</div>{isBreak ? <div className="break-timer-card mt-6"><div className="text-xs font-extrabold tracking-[.18em] text-[var(--gold)]">CURRENT BREAK</div><div className="break-clock">{formatClock(breakMs)}</div>{isPomodoro && <div className="text-sm muted mt-1">{pomodoroBreakRemaining === 0 ? "5-minute break complete — resume when ready" : `${formatClock(pomodoroBreakRemaining ?? 0)} until your 5-minute break target`}</div>}</div> : isPomodoro ? <div className="muted mt-4">{pomodoroRemaining === 0 ? "25-minute round complete — take a 5-minute break" : "25-minute focus round"}</div> : session.mode === "timed" && <div className="muted mt-4">{remaining === 0 ? "Focus target reached — finish when you’re ready" : "focused time remaining"}</div>}<div className="muted mt-3 text-sm">Actual focus {formatDuration(totals.focusMs, true)} · Total breaks {formatDuration(totals.breakMs, true)}</div></div>
      <div className="flex flex-wrap justify-center gap-3">{isBreak ? <button className="btn btn-primary" disabled={busy} onClick={() => command("resume", { session_id: session.id })}><RotateCcw size={16} />Resume Focus</button> : <button className="btn btn-secondary" disabled={busy} onClick={() => command("break", { session_id: session.id })}><Coffee size={16} />{isPomodoro && pomodoroRemaining === 0 ? "Start 5 min Break" : "Take Break"}</button>}<button className="btn btn-ghost" disabled={busy} onClick={finish}><Flag size={16} />Finish</button></div>
    </section>
    <section className="panel p-6 mt-5"><p className="eyebrow">SESSION GOALS</p><h2 className="section-title mt-2">Adjust the plan while you work.</h2><EditableGoals session={session} /></section>
  </>;
}

function RoomObserver({ room }: { room: FocusRoom }) {
  const { user, command, busy } = useLab();
  const active = room.members.filter((m) => m.is_present && m.session && m.session.status !== "finished");
  const isCreator = room.created_by === user?.id;
  const otherActive = active.filter((m) => m.user_id !== user?.id);

  async function rejoinFocus() { await command("rejoin_room", { room_id: room.id }); }
  async function leaveAndStartAnother() { await command("leave_room", { room_id: room.id }); }
  async function leaveAndGoHome() { await command("leave_room", { room_id: room.id }); window.location.assign("/home"); }

  return <>
    <section className="panel p-7">
      <p className="eyebrow">SHARED ROOM</p>
      <h1 className="text-3xl sm:text-4xl font-extrabold mt-2">Your part is finished.</h1>
      <p className="lead mt-2">{otherActive.length ? `${otherActive.map((m) => m.name).join(", ")} ${otherActive.length === 1 ? "is" : "are"} still working.` : "Everyone else here is finished."}</p>
      <div className="info-box mt-5"><b>You can jump back in.</b> Rejoin focus to continue this same session, or leave and start something else. Your earlier focus time and goals stay recorded.</div>
      <div className="room-goals-grid mt-6">
        {room.members.filter((m) => m.is_present).map((member) => <div className={`participant-card ${member.session?.status === "finished" ? "finished" : ""}`} key={member.user_id}><div className="flex justify-between gap-3"><div><div className="font-extrabold">{member.user_id === user?.id ? "You" : member.name}</div><div className="text-sm muted mt-1">{member.session?.title || member.title}</div></div><span className={`room-status ${member.session?.status ?? "waiting"}`}>{sessionStatus(member)}</span></div><ReadOnlyGoals goals={member.session?.goals ?? []} /></div>)}
      </div>
      <div className="flex gap-3 mt-6 flex-wrap">
        <button className="btn btn-primary" disabled={busy} onClick={rejoinFocus}><RotateCcw size={16} />Rejoin focus</button>
        <button className="btn btn-secondary" disabled={busy} onClick={leaveAndStartAnother}>Start another focus</button>
        <button className="btn btn-secondary" disabled={busy} onClick={leaveAndGoHome}><LogOut size={16} />Leave room & go Home</button>
        {isCreator && <button className="btn btn-ghost" disabled={busy} onClick={() => command("cancel_room", { room_id: room.id })}>End shared room for everyone</button>}
      </div>
    </section>
    {otherActive.length > 0 && <div className="mt-5"><VideoPanel roomId={room.id} /></div>}
  </>;
}

function AvailableRooms({ rooms }: { rooms: FocusRoom[] }) {
  const { command, busy, user } = useLab();
  if (!rooms.length) return null;
  return (
    <section className="panel p-5 sm:p-6 mb-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div><p className="eyebrow">OPEN SHARED ROOMS</p><h2 className="section-title mt-2">Come back whenever you want.</h2><p className="muted text-sm mt-1">Leaving a room doesn’t delete your invite. Rejoin while that room is still open.</p></div>
        <Users className="muted" />
      </div>
      <div className="grid gap-3 mt-5">
        {rooms.map((room) => {
          const others = room.members.filter((m) => m.user_id !== user?.id).map((m) => m.name).join(", ");
          const activeNames = room.members.filter((m) => m.is_present && m.session && m.session.status !== "finished" && m.user_id !== user?.id).map((m) => m.name);
          const label = room.status === "active" ? "Rejoin room" : "Join room";
          return <div className="partner-row" key={room.id}><div className="min-w-0"><div className="font-bold">{others || "Shared focus room"}</div><div className="text-xs muted mt-1">{room.status === "active" ? (activeNames.length ? `${activeNames.join(", ")} ${activeNames.length === 1 ? "is" : "are"} focusing now` : "Room is still open") : "Waiting to start"}</div></div><button className="btn btn-secondary btn-small" disabled={busy} onClick={() => command("rejoin_room", { room_id: room.id })}>{label}</button></div>;
        })}
      </div>
    </section>
  );
}

function FocusPageInner() {
  const { state, loading, user, command } = useLab();
  const params = useSearchParams();
  const scheduleId = params.get("schedule");
  const scheduled = state?.schedules.find((s) => s.id === scheduleId) ?? null;
  const [shared, setShared] = useState(Boolean(scheduleId));
  const [finishedId, setFinishedId] = useState<string | null>(null);

  if (loading || !state) return <main className="page"><div className="lab-container muted">Loading your session…</div></main>;

  const finished = finishedId ? state.sessions.find((s) => s.id === finishedId && s.status === "finished") : null;
  if (finished) {
    const finishedRoom = finished.room_id && state.room?.id === finished.room_id && state.room.status === "active" ? state.room : null;
    const leaveFinishedRoom = async (goHome: boolean) => {
      if (finishedRoom) await command("leave_room", { room_id: finishedRoom.id });
      setFinishedId(null);
      if (goHome) window.location.assign("/home");
    };
    const rejoinFinishedRoom = async () => {
      if (!finishedRoom) return;
      await command("rejoin_room", { room_id: finishedRoom.id });
      setFinishedId(null);
    };
    return <main className="page"><div className="lab-container max-w-4xl"><SessionSummary session={finished} onDone={() => leaveFinishedRoom(true)} onAnother={() => leaveFinishedRoom(false)} onRejoin={finishedRoom ? rejoinFinishedRoom : undefined} /></div></main>;
  }

  const active = state.sessions.find((s) => s.status !== "finished");
  if (active) return <main className={`page ${active.room_id ? "focus-room-page" : ""}`}><div className={`lab-container ${active.room_id ? "focus-workspace-container" : ""}`}><ActiveTimer session={active} onFinished={setFinishedId} /></div></main>;
  if (state.room?.status === "waiting") return <main className="page"><div className="lab-container"><WaitingRoom /></div></main>;
  if (state.room?.status === "active") return <main className="page"><div className="lab-container"><RoomObserver room={state.room} /></div></main>;

  const scheduleAccepted = scheduled?.rsvps.includes(user?.id ?? "") ?? false;
  const partners = state.partners ?? [];
  const availableRooms = state.available_rooms ?? [];
  return (
    <main className="page">
      <div className="lab-container max-w-4xl">
        <AvailableRooms rooms={availableRooms} />
        <div className="page-head">
          <div><p className="eyebrow">FOCUS</p><h1 className="text-4xl sm:text-5xl font-extrabold tracking-[-.045em] mt-2">Begin with clarity.</h1>{scheduled && !scheduleAccepted && <p className="muted text-sm mt-2">You have not RSVP’d to this scheduled session yet. Confirm from Home first.</p>}</div>
          {partners.length > 0 && !scheduled && <div className="segmented"><button className={!shared ? "active" : ""} onClick={() => setShared(false)}>Solo</button><button className={shared ? "active" : ""} onClick={() => setShared(true)}>Shared room</button></div>}
        </div>
        <SessionSetup shared={scheduled ? true : shared} schedule={scheduled} />
      </div>
    </main>
  );
}

export default function FocusPage() {
  return <Suspense fallback={<main className="page"><div className="lab-container muted">Opening focus…</div></main>}><FocusPageInner /></Suspense>;
}
