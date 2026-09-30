"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Check, Coffee, Flag, Play, RotateCcw, Users } from "lucide-react";
import { useLab } from "@/components/lab-provider";
import { formatClock, formatDuration, sessionTotals } from "@/lib/metrics";
import type { FocusSession } from "@/lib/types";

function SessionSetup({ shared = false }: { shared?: boolean }) {
  const { state, command, busy, broadcast } = useLab();
  const settings = state?.profile?.settings;
  const [title, setTitle] = useState("");
  const [goalsText, setGoalsText] = useState("");
  const initialMode = settings?.focusDefault ?? "open";
  const [mode, setMode] = useState(String(initialMode));
  const [custom, setCustom] = useState(settings?.customMinutes ?? 60);

  const duration = mode === "open" ? null : mode === "custom" ? Math.max(1, custom) * 60 : Number(mode) * 60;
  const goals = goalsText.split("\n").map((v) => v.trim()).filter(Boolean).slice(0, 8);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    if (shared) {
      await command("create_room", { duration });
      await broadcast("focus_invite", { title: title.trim() });
    } else {
      await command("start", { title: title.trim(), duration, goals });
    }
  }

  return <section className="panel p-6 sm:p-8">
    <div className="flex items-center justify-between gap-4"><div><p className="eyebrow">{shared ? "WITH YOUR PARTNER" : "SOLO FOCUS"}</p><h2 className="text-3xl font-extrabold tracking-[-.04em] mt-2">What are you working on?</h2></div>{shared ? <Users className="muted"/> : <Play className="muted"/>}</div>
    <form onSubmit={submit} className="mt-7 space-y-5">
      <label className="field"><span>Focus on</span><input autoFocus value={title} onChange={(e)=>setTitle(e.target.value)} placeholder="Nanomaterials paper" maxLength={160} required/></label>
      <label className="field"><span>Optional goals · one per line</span><textarea value={goalsText} onChange={(e)=>setGoalsText(e.target.value)} placeholder={"Understand Figure 3\nWrite methods notes\nDraft conclusion"}/></label>
      <div><div className="text-xs muted font-bold mb-2">Mode</div><div className="segmented">{[["open","Open-ended"],["25","25 min"],["50","50 min"],["90","90 min"],["custom","Custom"]].map(([value,label])=><button type="button" key={value} onClick={()=>setMode(value)} className={mode===value?"active":""}>{label}</button>)}</div></div>
      {mode==="custom"&&<label className="field max-w-[180px]"><span>Minutes</span><input type="number" min={1} max={720} value={custom} onChange={(e)=>setCustom(Number(e.target.value))}/></label>}
      <button className="btn btn-primary" disabled={busy||!title.trim()}>{busy?"Starting…":shared?"Create shared room":"Start Focus"}</button>
    </form>
  </section>;
}

function WaitingRoom() {
  const { state, user, command, busy } = useLab(); const room=state?.room; if(!room||room.status!=="waiting")return null;
  const me=room.members.find(m=>m.user_id===user?.id); const partner=room.members.find(m=>m.user_id!==user?.id);
  const [title,setTitle]=useState(me?.title??""); const [goalsText,setGoalsText]=useState(Array.isArray(me?.goals)?me!.goals.join("\n"):"");
  const goals=goalsText.split("\n").map(v=>v.trim()).filter(Boolean).slice(0,8);
  return <section className="panel p-6 sm:p-8"><p className="eyebrow">SHARED ROOM</p><h2 className="text-3xl font-extrabold mt-2">Meet here, then disappear into the work.</h2><p className="muted mt-2">Both of you state the work, mark ready, and start together. Breaks and finishing stay independent.</p><div className="grid-2 mt-7"><div className="panel p-5"><div className="text-sm font-extrabold">You</div><label className="field mt-4"><span>Working on</span><input value={title} onChange={e=>setTitle(e.target.value)} disabled={me?.ready}/></label><label className="field mt-4"><span>Goals</span><textarea value={goalsText} onChange={e=>setGoalsText(e.target.value)} disabled={me?.ready}/></label><button className="btn btn-primary mt-4" disabled={busy||me?.ready||!title.trim()} onClick={()=>command("ready",{room_id:room.id,title:title.trim(),goals})}>{me?.ready?"Ready ✓":"I’m ready"}</button></div><div className="panel p-5"><div className="text-sm font-extrabold">{partner?.name??state?.partner?.name??"Partner"}</div><div className="mt-5 text-2xl font-bold">{partner?.ready?partner.title||"Ready to focus":"Waiting for them…"}</div><p className="muted mt-2">{partner?.ready?"They’re ready. The room starts automatically when you are too.":"Their private history stays private. You only see what belongs to this shared session."}</p><div className="mt-5"><span className={`status-dot mr-2 ${partner?.ready?"":"offline"}`}/><span className="text-sm muted">{partner?.ready?"Ready":"Not ready"}</span></div></div></div><button className="btn btn-ghost mt-5" disabled={busy} onClick={()=>command("cancel_room",{room_id:room.id})}>Cancel room</button></section>
}

function ActiveTimer({ session }: { session: FocusSession }) {
  const { state, command, busy, serverNow } = useLab();
  const [now,setNow]=useState(serverNow()); const [showSummary,setShowSummary]=useState(false);
  useEffect(()=>{const timer=window.setInterval(()=>setNow(serverNow()),1000);return()=>clearInterval(timer)},[serverNow]);
  const totals=useMemo(()=>sessionTotals(session,now),[session,now]); const isBreak=session.status==="break";
  const remaining=session.duration?Math.max(0,session.duration*1000-totals.focusMs):null;
  const displayed=session.mode==="timed"&&remaining!==null?remaining:totals.focusMs;
  const room=state?.room; const partnerMember=room?.members.find(m=>m.user_id!==session.user_id);
  async function finish(){await command("finish",{session_id:session.id});setShowSummary(true)}
  if(showSummary){return <section className="panel p-8 text-center"><p className="eyebrow">SESSION COMPLETE</p><h2 className="text-4xl font-extrabold mt-3">You showed up.</h2><div className="grid-3 mt-7 text-left"><div className="stat"><div className="stat-label">Focused</div><div className="stat-value">{formatDuration(totals.focusMs,true)}</div></div><div className="stat"><div className="stat-label">Breaks</div><div className="stat-value">{formatDuration(totals.breakMs,true)}</div></div><div className="stat"><div className="stat-label">Focus ratio</div><div className="stat-value">{Math.round(totals.focusRatio)}%</div></div></div><p className="muted mt-6">{session.goals.filter(g=>g.completed).length} of {session.goals.length} session goals completed · {totals.focusPeriods} focus period{totals.focusPeriods===1?"":"s"}</p><button className="btn btn-primary mt-6" onClick={()=>setShowSummary(false)}>Done</button></section>}
  return <section className={`panel timer-screen ${isBreak?"break-mode":""}`}><div><div className="timer-label">{isBreak?"BREAK":"FOCUS"}</div><div className="mt-3 text-xl font-bold">{session.title}</div></div><div><div className="timer-clock">{formatClock(displayed)}</div>{session.mode==="timed"&&<div className="muted mt-4">{remaining===0?"Focus target reached — finish when you’re ready":"focused time remaining"}</div>}<div className="muted mt-2 text-sm">Actual focus {formatDuration(totals.focusMs,true)} · Breaks {formatDuration(totals.breakMs,true)}</div></div><div className="w-full max-w-2xl"><div className="goals">{session.goals.map(g=><div key={g.id} className={`goal ${g.completed?"done":""}`}><button onClick={()=>command("goal",{goal_id:g.id,completed:!g.completed})} disabled={busy}>{g.completed?<Check size={14}/>:null}</button><span className="goal-text">{g.text}</span></div>)}</div>{partnerMember?.session&&<div className="mt-5 px-4 py-3 rounded-xl border border-[var(--line)] text-sm flex justify-between gap-4"><span className="muted">{partnerMember.name}</span><span className="font-bold">{partnerMember.session.status==="break"?"On break":"Focusing"} · {partnerMember.session.title}</span></div>}<div className="flex flex-wrap justify-center gap-3 mt-6">{isBreak?<button className="btn btn-primary" disabled={busy} onClick={()=>command("resume",{session_id:session.id})}><RotateCcw size={16}/>Resume Focus</button>:<button className="btn btn-secondary" disabled={busy} onClick={()=>command("break",{session_id:session.id})}><Coffee size={16}/>Take Break</button>}<button className="btn btn-ghost" disabled={busy} onClick={finish}><Flag size={16}/>Finish</button></div></div></section>
}

export default function FocusPage(){const{state,loading}=useLab();const[shared,setShared]=useState(false);if(loading||!state)return<main className="page"><div className="lab-container muted">Loading your session…</div></main>;const active=state.sessions.find(s=>s.status!=="finished");if(active)return<main className="page"><div className="lab-container"><ActiveTimer session={active}/></div></main>;if(state.room?.status==="waiting")return<main className="page"><div className="lab-container"><WaitingRoom/></div></main>;return <main className="page"><div className="lab-container max-w-4xl"><div className="page-head"><div><p className="eyebrow">FOCUS</p><h1 className="text-4xl sm:text-5xl font-extrabold tracking-[-.045em] mt-2">Begin with clarity.</h1></div>{state.partner&&<div className="segmented"><button className={!shared?"active":""} onClick={()=>setShared(false)}>Solo</button><button className={shared?"active":""} onClick={()=>setShared(true)}>With {state.partner.name}</button></div>}</div><SessionSetup shared={shared}/></div></main>}
