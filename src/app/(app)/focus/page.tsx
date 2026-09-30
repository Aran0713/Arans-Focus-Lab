"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Check, ChevronDown, ChevronUp, Coffee, Flag, GripVertical, Pencil, Play, Plus, RotateCcw, Save, Trash2, Users, X } from "lucide-react";
import { useLab } from "@/components/lab-provider";
import { VideoPanel } from "@/components/video-panel";
import { formatClock, formatDuration, intervalDuration, sessionTotals } from "@/lib/metrics";
import type { FocusRoom, FocusSession, RoomMember, ScheduledSession, SharedGoal } from "@/lib/types";

const parseGoals = (value:string) => value.split("\n").map(v=>v.trim()).filter(Boolean).slice(0,8);

function GoalDraftPreview({value}:{value:string}){
  const goals=parseGoals(value);
  return <div className="goal-draft-preview"><div className="goal-draft-caption">Each new line becomes its own checkbox in the session.</div>{goals.length?<div className="goal-draft-list">{goals.map((goal,index)=><div className="goal-draft-item" key={`${goal}-${index}`}><span>{index+1}</span><b>{goal}</b></div>)}</div>:<div className="goal-draft-empty">Type Goal 1, press Enter, then type Goal 2.</div>}</div>;
}

function PartnerPicker({ selected, onToggle }: { selected:string[]; onToggle:(id:string)=>void }) {
  const { state, partnerOnline } = useLab();
  const partners=state?.partners??[];
  return <div><div className="text-xs muted font-bold mb-2">Invite partners · up to 3</div><div className="partner-picker">{partners.map(partner=><button type="button" key={partner.id} className={selected.includes(partner.id)?"selected":""} onClick={()=>onToggle(partner.id)}><span className={`status-dot ${partnerOnline[partner.id]?"":"offline"}`}/>{partner.name}{selected.includes(partner.id)&&<Check size={14}/>}</button>)}</div></div>;
}

function SessionSetup({ shared=false, schedule }: { shared?:boolean; schedule?:ScheduledSession|null }) {
  const { state,user,command,busy,broadcast }=useLab();
  const settings=state?.profile?.settings;
  const scheduledMinutes=schedule?.duration?Math.round(schedule.duration/60):null;
  const schedulePartners=useMemo(()=>schedule?.members.filter(m=>m.id!==user?.id).map(m=>m.id)??[],[schedule,user?.id]);
  const [title,setTitle]=useState(schedule?.title??"");
  const [goalsText,setGoalsText]=useState("");
  const initialMode=schedule?(scheduledMinutes===25?"25":scheduledMinutes===50?"50":scheduledMinutes===90?"90":"custom"):(settings?.focusDefault??"open");
  const [mode,setMode]=useState(String(initialMode));
  const [custom,setCustom]=useState(scheduledMinutes&&![25,50,90].includes(scheduledMinutes)?scheduledMinutes:(settings?.customMinutes??60));
  const [selectedPartners,setSelectedPartners]=useState<string[]>(schedulePartners.length?schedulePartners:(state?.partners?.length===1?[state.partners[0].id]:[]));

  useEffect(()=>{if(schedule){setTitle(schedule.title);setSelectedPartners(schedulePartners)}},[schedule?.id,schedule?.title,schedulePartners]);
  if(!state)return null;
  const duration=mode==="open"?null:mode==="custom"?Math.max(1,custom)*60:Number(mode)*60;
  const goals=parseGoals(goalsText);
  const allScheduledCommitted=schedule? schedule.members.length>0&&schedule.rsvps.length===schedule.members.length:true;

  function togglePartner(id:string){setSelectedPartners(current=>current.includes(id)?current.filter(v=>v!==id):current.length<3?[...current,id]:current)}
  async function submit(e:FormEvent){
    e.preventDefault();if(!title.trim())return;
    if(shared){
      if(selectedPartners.length===0||!allScheduledCommitted)return;
      const result=await command("create_room",{duration,title:title.trim(),goals,partner_ids:selectedPartners});
      await broadcast("focus_invite",{title:title.trim(),partner_ids:selectedPartners,room_id:result?.room_id});
    } else await command("start",{title:title.trim(),duration,goals});
  }

  return <section className="panel p-6 sm:p-8"><div className="flex items-center justify-between gap-4"><div><p className="eyebrow">{shared?"SHARED FOCUS":"SOLO FOCUS"}</p><h2 className="text-3xl font-extrabold tracking-[-.04em] mt-2">{schedule?"Your scheduled session is ready.":"What are you working on?"}</h2>{schedule&&<p className="muted text-sm mt-2">{new Date(schedule.scheduled_for).toLocaleString()} · {schedule.rsvps.length}/{schedule.members.length} committed</p>}</div>{shared?<Users className="muted"/>:<Play className="muted"/>}</div>
    <form onSubmit={submit} className="mt-7 space-y-5">
      <label className="field"><span>Focus on</span><input autoFocus value={title} onChange={e=>setTitle(e.target.value)} placeholder="Nanomaterials paper" maxLength={160} required/></label>
      <label className="field"><span>Goals for this session · press Enter for the next goal</span><textarea value={goalsText} onChange={e=>setGoalsText(e.target.value)} placeholder={"Understand Figure 3\nWrite methods notes\nDraft conclusion"}/></label>
      <GoalDraftPreview value={goalsText}/>
      {shared&&!schedule&&<PartnerPicker selected={selectedPartners} onToggle={togglePartner}/>} {shared&&schedule&&<div className="info-box">Room: {schedule.members.filter(m=>m.id!==user?.id).map(m=>m.name).join(", ")}{!allScheduledCommitted&&" · Waiting for every invitee to RSVP."}</div>}
      <div><div className="text-xs muted font-bold mb-2">Mode</div><div className="segmented">{[["open","Open-ended"],["25","Pomodoro · 25/5"],["50","50 min"],["90","90 min"],["custom","Custom"]].map(([value,label])=><button type="button" key={value} onClick={()=>setMode(value)} className={mode===value?"active":""}>{label}</button>)}</div></div>
      {mode==="custom"&&<label className="field max-w-[180px]"><span>Minutes</span><input type="number" min={1} max={720} value={custom} onChange={e=>setCustom(Number(e.target.value))}/></label>}
      {mode==="25"&&<div className="info-box">Pomodoro repeats 25-minute focus rounds with 5-minute break targets while actual focus and break time stay recorded separately.</div>}
      <button className="btn btn-primary" disabled={busy||!title.trim()||(shared&&selectedPartners.length===0)||(shared&&!allScheduledCommitted)}>{busy?"Starting…":shared?"Create shared room":"Start Focus"}</button>
    </form>
  </section>;
}

function WaitingRoom(){
  const{state,user,command,busy,broadcast}=useLab();
  const room=state?.room;
  if(!room||room.status!=="waiting")return null;
  const roomId=room.id;
  const me=room.members.find(m=>m.user_id===user?.id);
  const[title,setTitle]=useState(me?.title??"");
  const[goalsText,setGoalsText]=useState(Array.isArray(me?.goals)?me.goals.join("\n"):"");
  const goals=parseGoals(goalsText);
  async function saveDraft(){if(!me||!title.trim())return;await command("room_member_update",{room_id:roomId,title:title.trim(),goals});await broadcast("state_changed",{room_id:roomId})}
  async function ready(){if(!me||!title.trim())return;await command("ready",{room_id:roomId,title:title.trim(),goals})}
  return <><section className="panel p-6 sm:p-8"><div className="flex items-start justify-between gap-5"><div><p className="eyebrow">SHARED ROOM</p><h2 className="text-3xl font-extrabold mt-2">Meet here, then disappear into the work.</h2><p className="muted mt-2">Everyone can see this room’s goals. Private history and statistics stay private.</p></div><span className="kbd-pill">{room.members.filter(m=>m.ready).length}/{room.members.length} ready</span></div>
    <div className="waiting-grid mt-7">{room.members.map(member=>member.user_id===user?.id?<div className="participant-card mine" key={member.user_id}><ParticipantHead member={member} you/><label className="field mt-4"><span>Working on</span><input value={title} onChange={e=>setTitle(e.target.value)} disabled={member.ready}/></label><label className="field mt-4"><span>Goals for this session · one goal per line</span><textarea value={goalsText} onChange={e=>setGoalsText(e.target.value)} disabled={member.ready}/></label>{!member.ready&&<GoalDraftPreview value={goalsText}/>}<div className="flex gap-2 mt-4 flex-wrap">{!member.ready&&<button className="btn btn-ghost" disabled={busy||!title.trim()} onClick={saveDraft}>Save draft</button>}<button className="btn btn-primary" disabled={busy||member.ready||!title.trim()} onClick={ready}>{member.ready?"Ready ✓":"I’m ready"}</button></div></div>:<WaitingMemberCard member={member} key={member.user_id}/>)}</div>
    <div className="flex gap-3 mt-5 flex-wrap"><button className="btn btn-ghost" disabled={busy} onClick={()=>command("cancel_room",{room_id:roomId})}>Cancel room</button></div></section><div className="mt-5"><VideoPanel roomId={roomId}/></div></>;
}

function WaitingMemberCard({member}:{member:RoomMember}){const goals=Array.isArray(member.goals)?member.goals:[];return <div className="participant-card"><ParticipantHead member={member}/><div className="mt-5 text-xl font-bold">{member.title||"Waiting for their plan…"}</div>{goals.length?<div className="goals mt-4">{goals.map((goal,index)=><div className="goal" key={`${goal}-${index}`}><span className="goal-bullet"/><span className="goal-text">{goal}</span></div>)}</div>:<p className="muted text-sm mt-3">Their shared-session goals will appear here.</p>}</div>}

function ParticipantHead({member,you=false}:{member:RoomMember;you?:boolean}){return <div className="flex items-center justify-between gap-3"><div className="font-extrabold">{you?"You":member.name}</div><span className={`room-status ${member.ready?"ready":"waiting"}`}>{member.ready?"Ready":"Not ready"}</span></div>}

function sessionStatus(member:RoomMember){if(!member.session)return member.ready?"Ready":"Waiting";if(member.session.status==="break")return"On break";if(member.session.status==="finished")return"Finished";return"Focusing"}

function EditableGoals({session,compact=false}:{session:FocusSession;compact?:boolean}){
  const{command,busy}=useLab();
  const[draft,setDraft]=useState("");
  const[editingId,setEditingId]=useState<string|null>(null);
  const[editingText,setEditingText]=useState("");
  const[dragId,setDragId]=useState<string|null>(null);
  const goals=[...session.goals].sort((a,b)=>a.position-b.position);
  async function add(){const text=draft.trim();if(!text||goals.length>=8)return;await command("add_goal",{session_id:session.id,text});setDraft("")}
  async function save(id:string){const text=editingText.trim();if(!text)return;await command("update_goal",{goal_id:id,text});setEditingId(null);setEditingText("")}
  async function remove(id:string){await command("delete_goal",{goal_id:id});if(editingId===id){setEditingId(null);setEditingText("")}}
  async function reorder(targetId:string){if(!dragId||dragId===targetId)return;const from=goals.findIndex(g=>g.id===dragId),to=goals.findIndex(g=>g.id===targetId);if(from<0||to<0)return;const next=[...goals];const[moved]=next.splice(from,1);next.splice(to,0,moved);setDragId(null);await command("reorder_goals",{goal_ids:next.map(g=>g.id)})}
  async function shift(id:string,direction:-1|1){const from=goals.findIndex(g=>g.id===id),to=from+direction;if(from<0||to<0||to>=goals.length)return;const next=[...goals];[next[from],next[to]]=[next[to],next[from]];await command("reorder_goals",{goal_ids:next.map(g=>g.id)})}
  return <div className={compact?"":"mt-4"}><div className="goals">{goals.map((goal,index)=><div className={`goal editable-goal ${goal.completed?"done":""}`} key={goal.id} draggable={!editingId} onDragStart={()=>setDragId(goal.id)} onDragOver={e=>e.preventDefault()} onDrop={()=>reorder(goal.id)}><div className="mobile-reorder" aria-label="Reorder goal"><button type="button" aria-label="Move goal up" disabled={busy||Boolean(editingId)||index===0} onClick={()=>shift(goal.id,-1)}><ChevronUp size={13}/></button><button type="button" aria-label="Move goal down" disabled={busy||Boolean(editingId)||index===goals.length-1} onClick={()=>shift(goal.id,1)}><ChevronDown size={13}/></button></div><GripVertical size={15} className="drag-handle" aria-hidden="true"/><button disabled={busy||editingId===goal.id} onClick={()=>command("goal",{goal_id:goal.id,completed:!goal.completed})}>{goal.completed?<Check size={14}/>:null}</button>{editingId===goal.id?<input className="inline-edit" autoFocus value={editingText} maxLength={200} onChange={e=>setEditingText(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();save(goal.id)}if(e.key==="Escape"){setEditingId(null);setEditingText("")}}}/>:<span className="goal-text flex-1">{goal.text}</span>}<div className="goal-actions">{editingId===goal.id?<><button className="icon-btn" aria-label="Save goal" onClick={()=>save(goal.id)} disabled={!editingText.trim()||busy}><Save size={14}/></button><button className="icon-btn" aria-label="Cancel edit" onClick={()=>{setEditingId(null);setEditingText("")}}><X size={14}/></button></>:<><button className="icon-btn" aria-label="Edit goal" disabled={busy} onClick={()=>{setEditingId(goal.id);setEditingText(goal.text)}}><Pencil size={13}/></button><button className="icon-btn danger" aria-label="Delete goal" disabled={busy} onClick={()=>remove(goal.id)}><Trash2 size={13}/></button></>}</div></div>)}</div>{goals.length<8&&<div className="flex gap-2 mt-3"><input className="inline-add" value={draft} maxLength={200} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();add()}}} placeholder="Add a goal during the session"/><button className="btn btn-ghost btn-small" disabled={busy||!draft.trim()} onClick={add}><Plus size={14}/>Add</button></div>}</div>;
}

function ReadOnlyGoals({goals}:{goals:SharedGoal[]}){const ordered=[...goals].sort((a,b)=>a.position-b.position);return <div className="goals mt-4">{ordered.length?ordered.map(goal=><div className={`goal ${goal.completed?"done":""}`} key={goal.id}><span className="w-[19px] h-[19px] grid place-items-center">{goal.completed?<Check size={14}/>:null}</span><span className="goal-text">{goal.text}</span></div>):<div className="text-sm muted">No goals added yet.</div>}</div>}

function SharedGoalsBoard({room,session}:{room:FocusRoom;session:FocusSession}){return <section className="panel p-6 mt-5"><div className="flex items-start justify-between gap-4"><div><p className="eyebrow">SHARED GOALS</p><h2 className="section-title mt-2">Work separately. Stay accountable together.</h2></div><span className="kbd-pill">{room.members.length} people</span></div><div className="room-goals-grid mt-5">{room.members.map(member=>member.user_id===session.user_id?<div className="participant-card mine" key={member.user_id}><div className="flex justify-between gap-3"><div><div className="font-extrabold">You</div><div className="text-sm muted mt-1">{session.title}</div></div><span className={`room-status ${session.status}`}>{sessionStatus(member)}</span></div><EditableGoals session={session}/></div>:<div className={`participant-card ${member.session?.status==="finished"?"finished":""}`} key={member.user_id}><div className="flex justify-between gap-3"><div><div className="font-extrabold">{member.name}</div><div className="text-sm muted mt-1">{member.session?.title||member.title||"Waiting"}</div></div><span className={`room-status ${member.session?.status??"waiting"}`}>{sessionStatus(member)}</span></div><ReadOnlyGoals goals={member.session?.goals??[]}/></div>)}</div></section>}

function SessionSummary({session,onDone,onAnother}:{session:FocusSession;onDone:()=>void;onAnother:()=>void}){
  const{command,busy}=useLab();const totals=sessionTotals(session,session.finished_at?new Date(session.finished_at).getTime():Date.now());const completed=session.goals.filter(g=>g.completed).length;
  return <section className="panel p-7 sm:p-10 text-center"><p className="eyebrow">SESSION COMPLETE</p><h2 className="text-4xl sm:text-5xl font-extrabold mt-3">You showed up.</h2><p className="lead mt-2">Here’s what actually happened.</p><div className="grid-3 mt-7 text-left"><div className="stat"><div className="stat-label">Total elapsed</div><div className="stat-value">{formatDuration(totals.elapsedMs,true)}</div></div><div className="stat"><div className="stat-label">Focused</div><div className="stat-value">{formatDuration(totals.focusMs,true)}</div></div><div className="stat"><div className="stat-label">Breaks</div><div className="stat-value">{formatDuration(totals.breakMs,true)}</div></div></div><div className="grid-3 mt-3 text-left"><div className="stat"><div className="stat-label">Focus ratio</div><div className="stat-value">{Math.round(totals.focusRatio)}%</div></div><div className="stat"><div className="stat-label">Focus periods</div><div className="stat-value">{totals.focusPeriods}</div></div><div className="stat"><div className="stat-label">Goals</div><div className="stat-value">{completed}/{session.goals.length}</div></div></div>{session.goals.length>0&&<div className="goals mt-6 max-w-xl mx-auto">{session.goals.map(g=><div key={g.id} className={`goal ${g.completed?"done":""}`}><span className="w-[19px] h-[19px] grid place-items-center">{g.completed?<Check size={15}/>:null}</span><span className="goal-text">{g.text}</span></div>)}</div>}<div className="mt-7"><div className="text-xs muted font-bold mb-3">How did that session feel?</div><div className="segmented justify-center">{([[1,"Poor"],[2,"Okay"],[3,"Good"],[4,"Great"]] as const).map(([value,label])=><button key={value} disabled={busy} className={session.rating===value?"active":""} onClick={()=>command("rate",{session_id:session.id,rating:value})}>{label}</button>)}</div></div><div className="flex flex-wrap justify-center gap-3 mt-7"><button className="btn btn-primary" onClick={onDone}>Done</button><button className="btn btn-secondary" onClick={onAnother}>Start Another</button></div></section>;
}

function ActiveTimer({session,onFinished}:{session:FocusSession;onFinished:(id:string)=>void}){
  const{state,command,busy,serverNow}=useLab();const[now,setNow]=useState(serverNow());
  useEffect(()=>{const timer=window.setInterval(()=>setNow(serverNow()),1000);return()=>clearInterval(timer)},[serverNow]);
  const totals=useMemo(()=>sessionTotals(session,now),[session,now]);const isBreak=session.status==="break";const activeInterval=[...(session.intervals??[])].reverse().find(i=>!i.ended_at);const currentIntervalMs=activeInterval?intervalDuration(activeInterval,now):0;const isPomodoro=session.mode==="timed"&&session.duration===25*60;const remaining=session.duration?Math.max(0,session.duration*1000-totals.focusMs):null;const pomodoroRemaining=isPomodoro&&!isBreak?Math.max(0,25*60*1000-currentIntervalMs):null;const displayed=isBreak?totals.focusMs:isPomodoro&&pomodoroRemaining!==null?pomodoroRemaining:session.mode==="timed"&&remaining!==null?remaining:totals.focusMs;const breakMs=isBreak&&activeInterval?.kind==="break"?currentIntervalMs:0;const pomodoroBreakRemaining=isPomodoro&&isBreak?Math.max(0,5*60*1000-breakMs):null;const room=session.room_id&&state?.room?.id===session.room_id?state.room:null;
  async function finish(){await command("finish",{session_id:session.id});onFinished(session.id)}
  return <><section className={`panel timer-screen ${isBreak?"break-mode":""}`}><div><div className="timer-label">{isBreak?"BREAK":isPomodoro?`POMODORO · ROUND ${Math.max(1,totals.focusPeriods)}`:"FOCUS"}</div><div className="mt-3 text-xl font-bold">{session.title}</div></div><div><div className="timer-clock">{formatClock(displayed)}</div>{isBreak?<div className="break-timer-card mt-6"><div className="text-xs font-extrabold tracking-[.18em] text-[var(--gold)]">CURRENT BREAK</div><div className="break-clock">{formatClock(breakMs)}</div>{isPomodoro&&<div className="text-sm muted mt-1">{pomodoroBreakRemaining===0?"5-minute break complete — resume when ready":`${formatClock(pomodoroBreakRemaining??0)} until your 5-minute break target`}</div>}</div>:isPomodoro?<div className="muted mt-4">{pomodoroRemaining===0?"25-minute round complete — take a 5-minute break":"25-minute focus round"}</div>:session.mode==="timed"&&<div className="muted mt-4">{remaining===0?"Focus target reached — finish when you’re ready":"focused time remaining"}</div>}<div className="muted mt-3 text-sm">Actual focus {formatDuration(totals.focusMs,true)} · Total breaks {formatDuration(totals.breakMs,true)}</div></div><div className="flex flex-wrap justify-center gap-3">{isBreak?<button className="btn btn-primary" disabled={busy} onClick={()=>command("resume",{session_id:session.id})}><RotateCcw size={16}/>Resume Focus</button>:<button className="btn btn-secondary" disabled={busy} onClick={()=>command("break",{session_id:session.id})}><Coffee size={16}/>{isPomodoro&&pomodoroRemaining===0?"Start 5 min Break":"Take Break"}</button>}<button className="btn btn-ghost" disabled={busy} onClick={finish}><Flag size={16}/>Finish</button></div></section>{room?<><SharedGoalsBoard room={room} session={session}/><div className="mt-5"><VideoPanel roomId={room.id}/></div></>:<section className="panel p-6 mt-5"><p className="eyebrow">SESSION GOALS</p><h2 className="section-title mt-2">Adjust the plan while you work.</h2><EditableGoals session={session}/></section>}</>;
}

function RoomObserver({room}:{room:FocusRoom}){const active=room.members.filter(m=>m.session&&m.session.status!=="finished");return <><section className="panel p-7"><p className="eyebrow">SHARED ROOM</p><h1 className="text-3xl sm:text-4xl font-extrabold mt-2">Your part is finished.</h1><p className="lead mt-2">{active.length?`${active.map(m=>m.name).join(", ")} ${active.length===1?"is":"are"} still working. Their status updates here automatically.`:"Everyone is finished."}</p><div className="room-goals-grid mt-6">{room.members.map(member=><div className={`participant-card ${member.session?.status==="finished"?"finished":""}`} key={member.user_id}><div className="flex justify-between gap-3"><div><div className="font-extrabold">{member.name}</div><div className="text-sm muted mt-1">{member.session?.title||member.title}</div></div><span className={`room-status ${member.session?.status??"waiting"}`}>{sessionStatus(member)}</span></div><ReadOnlyGoals goals={member.session?.goals??[]}/></div>)}</div><Link href="/home" className="btn btn-primary mt-6">Back Home</Link></section>{active.length>0&&<div className="mt-5"><VideoPanel roomId={room.id}/></div>}</>}

function FocusPageInner(){
  const{state,loading,user}=useLab();const params=useSearchParams();const scheduleId=params.get("schedule");const scheduled=state?.schedules.find(s=>s.id===scheduleId)??null;const[shared,setShared]=useState(Boolean(scheduleId));const[finishedId,setFinishedId]=useState<string|null>(null);
  if(loading||!state)return<main className="page"><div className="lab-container muted">Loading your session…</div></main>;
  const finished=finishedId?state.sessions.find(s=>s.id===finishedId&&s.status==="finished"):null;
  if(finished)return<main className="page"><div className="lab-container max-w-4xl"><SessionSummary session={finished} onDone={()=>{setFinishedId(null);window.location.assign("/home")}} onAnother={()=>setFinishedId(null)}/></div></main>;
  const active=state.sessions.find(s=>s.status!=="finished");if(active)return<main className="page"><div className="lab-container"><ActiveTimer session={active} onFinished={setFinishedId}/></div></main>;
  if(state.room?.status==="waiting")return<main className="page"><div className="lab-container"><WaitingRoom/></div></main>;
  if(state.room?.status==="active")return<main className="page"><div className="lab-container"><RoomObserver room={state.room}/></div></main>;
  const scheduleAccepted=scheduled?.rsvps.includes(user?.id??"")??false;const partners=state.partners??[];
  return <main className="page"><div className="lab-container max-w-4xl"><div className="page-head"><div><p className="eyebrow">FOCUS</p><h1 className="text-4xl sm:text-5xl font-extrabold tracking-[-.045em] mt-2">Begin with clarity.</h1>{scheduled&&!scheduleAccepted&&<p className="muted text-sm mt-2">You have not RSVP’d to this scheduled session yet. Confirm from Home first.</p>}</div>{partners.length>0&&!scheduled&&<div className="segmented"><button className={!shared?"active":""} onClick={()=>setShared(false)}>Solo</button><button className={shared?"active":""} onClick={()=>setShared(true)}>Shared room</button></div>}</div><SessionSetup shared={scheduled?true:shared} schedule={scheduled}/></div></main>;
}

export default function FocusPage(){return <Suspense fallback={<main className="page"><div className="lab-container muted">Opening focus…</div></main>}><FocusPageInner/></Suspense>}
