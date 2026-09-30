"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { ArrowRight, CalendarDays, Check, ChevronDown, ChevronUp, GripVertical, Pencil, Plus, Save, Trash2, Users, X } from "lucide-react";
import { useLab } from "@/components/lab-provider";
import { addDays, formatDuration, localDateKey, rangeTotals, startOfDay } from "@/lib/metrics";
import type { TodayCommitment } from "@/lib/types";

export default function HomePage(){
  const{state,user,loading,busy,partnerOnline,broadcast,command}=useLab();
  const[draft,setDraft]=useState("");
  const[editingId,setEditingId]=useState<string|null>(null);
  const[editingText,setEditingText]=useState("");
  const[dragId,setDragId]=useState<string|null>(null);
  const[scheduledTitle,setScheduledTitle]=useState("");
  const[scheduledFor,setScheduledFor]=useState("");
  const[scheduledDuration,setScheduledDuration]=useState(50);
  const[selectedPartners,setSelectedPartners]=useState<string[]>([]);

  if(loading||!state)return <main className="page"><div className="lab-container muted">Loading Focus Lab…</div></main>;
  const profile=state.profile;
  const partners=state.partners??[];
  const now=new Date();
  const today=rangeTotals(state.sessions,startOfDay(now),addDays(startOfDay(now),1));
  const active=state.sessions.find(s=>s.status!=="finished");
  const settings=profile.settings??{};
  const dateKey=localDateKey(now);
  const commitments:TodayCommitment[]=settings.today3?.date===dateKey?settings.today3.items:[];
  const upcoming=state.schedules
    .filter(s=>new Date(s.scheduled_for).getTime()>now.getTime()-2*60*60*1000)
    .sort((a,b)=>new Date(a.scheduled_for).getTime()-new Date(b.scheduled_for).getTime());
  const nextSchedule=upcoming[0]??null;

  async function saveToday(items:TodayCommitment[]){await command("profile",{name:profile.display_name,settings:{...settings,today3:{date:dateKey,items}}})}
  async function addCommitment(){const text=draft.trim();if(!text||commitments.length>=3)return;await saveToday([...commitments,{id:crypto.randomUUID(),text,done:false}]);setDraft("")}
  async function toggleCommitment(id:string){await saveToday(commitments.map(item=>item.id===id?{...item,done:!item.done}:item))}
  async function deleteCommitment(id:string){await saveToday(commitments.filter(item=>item.id!==id));if(editingId===id){setEditingId(null);setEditingText("")}}
  function beginEdit(item:TodayCommitment){setEditingId(item.id);setEditingText(item.text)}
  async function saveEdit(id:string){const text=editingText.trim();if(!text)return;await saveToday(commitments.map(item=>item.id===id?{...item,text}:item));setEditingId(null);setEditingText("")}
  async function moveCommitment(targetId:string){if(!dragId||dragId===targetId)return;const from=commitments.findIndex(i=>i.id===dragId);const to=commitments.findIndex(i=>i.id===targetId);if(from<0||to<0)return;const next=[...commitments];const[moved]=next.splice(from,1);next.splice(to,0,moved);setDragId(null);await saveToday(next)}
  async function shiftCommitment(id:string,direction:-1|1){const from=commitments.findIndex(i=>i.id===id);const to=from+direction;if(from<0||to<0||to>=commitments.length)return;const next=[...commitments];[next[from],next[to]]=[next[to],next[from]];await saveToday(next)}

  function togglePartner(id:string){setSelectedPartners(current=>current.includes(id)?current.filter(v=>v!==id):current.length<3?[...current,id]:current)}
  async function schedule(e:FormEvent){
    e.preventDefault();
    if(!scheduledTitle.trim()||!scheduledFor||selectedPartners.length===0)return;
    await command("schedule",{title:scheduledTitle.trim(),scheduled_for:new Date(scheduledFor).toISOString(),duration:scheduledDuration*60,weekly:false,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,partner_ids:selectedPartners});
    setScheduledTitle("");setScheduledFor("");setSelectedPartners([]);
  }

  return <main className="page"><div className="lab-container">
    <div className="page-head"><div><p className="eyebrow">YOUR FOCUS LAB</p><h1 className="text-4xl sm:text-5xl font-extrabold tracking-[-.045em] mt-2">What matters now?</h1><p className="lead mt-2">One task. Honest breaks. A clear record of the work you actually did.</p></div></div>

    <div className="grid-2">
      <section className="panel hero-card"><div><p className="eyebrow">{active?"SESSION IN PROGRESS":"READY WHEN YOU ARE"}</p><h2>{active?active.title:"Start with one clear thing."}</h2><p className="muted max-w-lg">{active?`You are currently ${active.status}. Your session is safely stored in Focus Lab.`:"Open-ended is the default. Pomodoro and timed modes are there when structure helps."}</p></div><div className="flex items-end justify-between gap-5"><div className="focus-ring"><span>{formatDuration(today.focusMs,true)}</span></div><Link className="btn btn-primary" href="/focus">{active?"Return to focus":"Start Focus"}<ArrowRight size={17}/></Link></div></section>

      <aside className="space-y-4">
        <section className="panel p-5"><div className="flex items-center justify-between"><div><p className="eyebrow">FOCUS PARTNERS</p><h3 className="section-title mt-2">{partners.length?`${partners.length} of 3 connected`:"No partners connected"}</h3></div><Users size={20} className="muted"/></div>{partners.length?<div className="mt-4 space-y-3">{partners.map(partner=><div className="partner-row" key={partner.id}><div className="min-w-0"><div className="font-bold truncate">{partner.name}</div><div className="text-xs muted mt-1"><span className={`status-dot mr-2 ${partnerOnline[partner.id]?"":"offline"}`}/>{partnerOnline[partner.id]?"Online now":"Offline"}</div></div><button onClick={()=>broadcast("focus_invite",{title:"Ready for a focus session?",partner_ids:[partner.id]})} className="btn btn-ghost btn-small">Ping</button></div>)}</div>:<p className="text-sm muted mt-3">Connect trusted friends privately. Partners do not see each other unless you invite them into the same room.</p>}<Link href="/settings" className="btn btn-secondary mt-4">{partners.length?"Manage partners":"Invite a partner"}</Link></section>

        <section className="panel p-5"><div className="flex items-center justify-between"><div><p className="eyebrow">UP NEXT</p><h3 className="section-title mt-2">{nextSchedule?nextSchedule.title:"Nothing scheduled"}</h3></div><CalendarDays size={20} className="muted"/></div>{nextSchedule?<ScheduleMini schedule={nextSchedule} now={now} userId={user?.id??""} busy={busy} command={command}/>:<p className="text-sm muted mt-3">Schedule a shared session below when you need commitment before motivation.</p>}</section>
      </aside>
    </div>

    <div className="grid-3 mt-5"><div className="panel stat"><div className="stat-label">Focused today</div><div className="stat-value">{formatDuration(today.focusMs,true)}</div></div><div className="panel stat"><div className="stat-label">Breaks today</div><div className="stat-value">{formatDuration(today.breakMs,true)}</div></div><div className="panel stat"><div className="stat-label">Sessions today</div><div className="stat-value">{today.sessions}</div></div></div>

    <section className="panel p-6 mt-5"><div className="flex items-start justify-between gap-5"><div><p className="eyebrow">TODAY’S 3</p><h2 className="section-title mt-2">Keep the day small.</h2><p className="text-sm muted mt-2">Edit, reorder, or remove anything that stops being useful.</p></div><span className="text-xs muted">{commitments.filter(i=>i.done).length}/{commitments.length||0}</span></div>
      <div className="goals mt-5">{commitments.map((item,index)=><div className={`goal today-goal ${item.done?"done":""}`} key={item.id} draggable={!editingId} onDragStart={()=>setDragId(item.id)} onDragOver={e=>e.preventDefault()} onDrop={()=>moveCommitment(item.id)}><div className="mobile-reorder" aria-label="Reorder goal"><button type="button" aria-label="Move goal up" disabled={busy||Boolean(editingId)||index===0} onClick={()=>shiftCommitment(item.id,-1)}><ChevronUp size={13}/></button><button type="button" aria-label="Move goal down" disabled={busy||Boolean(editingId)||index===commitments.length-1} onClick={()=>shiftCommitment(item.id,1)}><ChevronDown size={13}/></button></div><GripVertical size={16} className="drag-handle" aria-hidden="true"/><button disabled={busy||editingId===item.id} onClick={()=>toggleCommitment(item.id)}>{item.done?<Check size={14}/>:null}</button>{editingId===item.id?<input autoFocus className="inline-edit" value={editingText} maxLength={120} onChange={e=>setEditingText(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();saveEdit(item.id)}if(e.key==="Escape"){setEditingId(null);setEditingText("")}}}/>:<span className="goal-text flex-1">{item.text}</span>}<div className="goal-actions">{editingId===item.id?<><button className="icon-btn" aria-label="Save" disabled={busy||!editingText.trim()} onClick={()=>saveEdit(item.id)}><Save size={15}/></button><button className="icon-btn" aria-label="Cancel" onClick={()=>{setEditingId(null);setEditingText("")}}><X size={15}/></button></>:<><button className="icon-btn" aria-label="Edit" disabled={busy} onClick={()=>beginEdit(item)}><Pencil size={14}/></button><button className="icon-btn danger" aria-label="Delete" disabled={busy} onClick={()=>deleteCommitment(item.id)}><Trash2 size={14}/></button></>}</div></div>)}</div>
      {commitments.length<3&&<div className="flex gap-2 mt-4"><input className="flex-1 min-w-0 bg-[var(--panel2)] border border-[var(--line)] rounded-xl px-3" value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();addCommitment()}}} placeholder="One thing that matters today" maxLength={120}/><button className="btn btn-secondary" disabled={busy||!draft.trim()} onClick={addCommitment}><Plus size={16}/>Add</button></div>}
    </section>

    {partners.length>0&&<section className="panel p-6 mt-5"><div className="flex items-start justify-between gap-4"><div><p className="eyebrow">SCHEDULE ACCOUNTABILITY</p><h2 className="section-title mt-2">Agree to show up.</h2><p className="muted text-sm mt-2">Pick the people for this session. Everyone RSVPs independently, and the room opens when it’s time.</p></div><CalendarDays className="muted"/></div>
      <form onSubmit={schedule} className="mt-5 space-y-4"><div className="schedule-form-grid"><input className="form-control" value={scheduledTitle} onChange={e=>setScheduledTitle(e.target.value)} placeholder="Tuesday study session" maxLength={160}/><input className="form-control" type="datetime-local" value={scheduledFor} onChange={e=>setScheduledFor(e.target.value)}/><select className="form-control" value={scheduledDuration} onChange={e=>setScheduledDuration(Number(e.target.value))}><option value={25}>25 min</option><option value={50}>50 min</option><option value={90}>90 min</option></select><button className="btn btn-primary" disabled={busy||!scheduledTitle.trim()||!scheduledFor||selectedPartners.length===0}>Schedule</button></div><div><div className="text-xs muted font-bold mb-2">Invite to this session</div><div className="partner-picker">{partners.map(partner=><button type="button" key={partner.id} className={selectedPartners.includes(partner.id)?"selected":""} onClick={()=>togglePartner(partner.id)}><span className={`status-dot ${partnerOnline[partner.id]?"":"offline"}`}/>{partner.name}{selectedPartners.includes(partner.id)&&<Check size={14}/>}</button>)}</div></div></form>
      {upcoming.length>0&&<div className="mt-6 schedule-list">{upcoming.map(s=><ScheduleRow key={s.id} schedule={s} now={now} userId={user?.id??""} busy={busy} command={command}/>)}</div>}
    </section>}
  </div></main>;
}

function ScheduleMini({schedule,now,userId,busy,command}:{schedule:any;now:Date;userId:string;busy:boolean;command:(action:string,payload?:Record<string,unknown>)=>Promise<unknown>}){
  const when=new Date(schedule.scheduled_for);const attending=schedule.rsvps.includes(userId);const allCommitted=schedule.members.length>0&&schedule.rsvps.length===schedule.members.length;const canOpen=when.getTime()<=now.getTime()+15*60*1000&&when.getTime()>now.getTime()-2*60*60*1000;
  return <><p className="text-sm muted mt-3">{when.toLocaleString()} · {schedule.duration?Math.round(schedule.duration/60):"Open-ended"} min</p><p className="text-xs muted mt-2">{schedule.rsvps.length}/{schedule.members.length} committed · {schedule.members.map((m:any)=>m.name).join(", ")}</p><div className="flex gap-2 mt-4 flex-wrap">{!attending?<button className="btn btn-secondary" disabled={busy} onClick={()=>command("rsvp",{schedule_id:schedule.id})}>I’ll be there</button>:<button className="btn btn-ghost" disabled={busy} onClick={()=>command("unrsvp",{schedule_id:schedule.id})}>Going ✓</button>}{canOpen&&allCommitted&&<Link className="btn btn-primary" href={`/focus?schedule=${schedule.id}`}>Open room</Link>}</div></>;
}

function ScheduleRow({schedule,now,userId,busy,command}:{schedule:any;now:Date;userId:string;busy:boolean;command:(action:string,payload?:Record<string,unknown>)=>Promise<unknown>}){
  const when=new Date(schedule.scheduled_for);const attending=schedule.rsvps.includes(userId);const allCommitted=schedule.members.length>0&&schedule.rsvps.length===schedule.members.length;const canOpen=when.getTime()<=now.getTime()+15*60*1000&&when.getTime()>now.getTime()-2*60*60*1000;const owner=schedule.created_by===userId;
  return <div className="history-row"><div className="min-w-0"><div className="font-bold">{schedule.title}</div><div className="text-xs muted mt-1">{when.toLocaleString()} · {schedule.duration?`${Math.round(schedule.duration/60)} min`:"Open-ended"} · {schedule.rsvps.length}/{schedule.members.length} committed</div><div className="text-xs muted mt-1 truncate">{schedule.members.map((m:any)=>`${m.name}${m.rsvp?" ✓":""}`).join(" · ")}</div></div><div className="flex gap-2 flex-wrap justify-end">{!attending?<button className="btn btn-secondary btn-small" disabled={busy} onClick={()=>command("rsvp",{schedule_id:schedule.id})}>RSVP</button>:<button className="btn btn-ghost btn-small" disabled={busy} onClick={()=>command("unrsvp",{schedule_id:schedule.id})}>Going ✓</button>}{canOpen&&allCommitted&&<Link className="btn btn-primary btn-small" href={`/focus?schedule=${schedule.id}`}>Open</Link>}{owner&&<button className="btn btn-ghost btn-small" disabled={busy} onClick={()=>command("cancel_schedule",{schedule_id:schedule.id})}>Cancel</button>}</div></div>;
}
