"use client";

import { FormEvent, useMemo, useState } from "react";
import { Copy, LogOut, UserRound, Users } from "lucide-react";
import { useLab } from "@/components/lab-provider";
import { createClient } from "@/lib/supabase/client";
import type { Appearance, FocusDefault, ProfileSettings } from "@/lib/types";

export default function SettingsPage(){
  const{state,user,loading,busy,partnerOnline,command}=useLab();
  const supabase=useMemo(()=>createClient(),[]);
  const[name,setName]=useState("");
  const[invite,setInvite]=useState("");
  const[inviteError,setInviteError]=useState("");
  if(loading||!state)return<main className="page"><div className="lab-container muted">Loading settings…</div></main>;
  const profile=state.profile;const settings:ProfileSettings=profile.settings??{};const partners=state.partners??[];

  async function saveSettings(patch:Partial<ProfileSettings>, displayName?:string){await command("profile",{name:displayName??profile.display_name,settings:{...settings,...patch}})}
  async function makeInvite(){
    if(!supabase)return;
    setInviteError("");
    const{data,error}=await supabase.rpc("create_partner_invite");
    if(error){setInviteError(error.message);return}
    const result=data as unknown as {token?:string};
    if(typeof result?.token==="string"){
      const link=`${window.location.origin}/invite/${result.token}`;
      setInvite(link);
      try{await navigator.clipboard?.writeText(link)}catch{}
    }
  }
  async function saveName(e:FormEvent){e.preventDefault();await saveSettings({},name.trim()||profile.display_name);setName("")}
  async function signOut(){await supabase?.auth.signOut();window.location.assign("/login")}

  return <main className="page"><div className="lab-container">
    <div className="page-head"><div><p className="eyebrow">SETTINGS</p><h1 className="text-4xl sm:text-5xl font-extrabold tracking-[-.045em] mt-2">Keep the lab quiet.</h1><p className="lead mt-2">Preferences live here. Planning and accountability stay on Home.</p></div></div>
    <div className="settings-grid">
      <section className="panel setting-card"><div className="flex justify-between"><div><p className="eyebrow">ACCOUNT</p><h2 className="section-title mt-2">{profile.display_name}</h2></div><UserRound className="muted" size={20}/></div><div className="text-sm muted mt-2">{user?.email}</div>{profile.display_name==="Focus friend"&&<div className="info-box mt-4">Set your name below so your focus partners know who they connected with.</div>}<form className="mt-5 flex gap-2" onSubmit={saveName}><input className="flex-1 min-w-0 bg-[var(--panel2)] border border-[var(--line)] rounded-xl px-3" value={name} onChange={e=>setName(e.target.value)} placeholder={profile.display_name==="Focus friend"?"Set the name partners should see":"Change display name"} maxLength={80}/><button className="btn btn-secondary" disabled={busy||!name.trim()}>Save</button></form><button onClick={signOut} className="btn btn-ghost mt-4"><LogOut size={16}/>Sign out</button></section>

      <section className="panel setting-card"><div className="flex justify-between"><div><p className="eyebrow">FOCUS PARTNERS</p><h2 className="section-title mt-2">{partners.length}/3 trusted people</h2></div><Users className="muted" size={20}/></div><p className="muted text-sm mt-3">Each connection is private by default. Partners only see one another when you invite them into the same room.</p>
        {partners.length>0&&<div className="mt-4 space-y-3">{partners.map(partner=><div className="partner-row" key={partner.id}><div className="min-w-0"><div className="font-bold truncate">{partner.name}</div><div className="text-xs muted mt-1"><span className={`status-dot mr-2 ${partnerOnline[partner.id]?"":"offline"}`}/>{partnerOnline[partner.id]?"Online":"Offline"}</div>{partner.name==="Focus friend"&&<div className="text-xs text-[var(--gold)] mt-1">They have not set a display name yet.</div>}</div><button disabled={busy} className="btn btn-danger btn-small" onClick={()=>command("disconnect",{partner_id:partner.id})}>Disconnect</button></div>)}</div>}
        {partners.length<3&&<><button disabled={busy} className="btn btn-secondary mt-5" onClick={makeInvite}><Copy size={16}/>Copy new invite link</button>{invite&&<div className="info-box mt-3 break-all">{invite}</div>}{inviteError&&<div className="error-box mt-3">{inviteError}</div>}<p className="text-xs muted mt-3">Each link expires after seven days and can be used once. You can create separate active links for different friends.</p></>}
      </section>

      <section className="panel setting-card"><p className="eyebrow">DEFAULT FOCUS</p><h2 className="section-title mt-2">How you usually start</h2><div className="segmented mt-5">{(["open","25","50","90","custom"] as FocusDefault[]).map(v=><button key={v} className={(settings.focusDefault??"open")===v?"active":""} onClick={()=>saveSettings({focusDefault:v})}>{v==="open"?"Open-ended":v==="25"?"Pomodoro · 25/5":v==="custom"?"Custom":`${v} min`}</button>)}</div></section>

      <section className="panel setting-card"><p className="eyebrow">APPEARANCE</p><h2 className="section-title mt-2">Easy on the eyes</h2><div className="segmented mt-5">{(["dark","light","system"] as Appearance[]).map(v=><button key={v} className={(settings.appearance??"system")===v?"active":""} onClick={()=>saveSettings({appearance:v})}>{v[0].toUpperCase()+v.slice(1)}</button>)}</div><div className="flex justify-between items-center mt-6"><div><div className="font-bold text-sm">Focus sounds</div><div className="text-xs muted mt-1">Subtle cues only</div></div><button className={`toggle ${settings.sounds?"on":""}`} onClick={()=>saveSettings({sounds:!settings.sounds})}><i/></button></div><div className="flex justify-between items-center mt-5"><div><div className="font-bold text-sm">Browser notifications</div><div className="text-xs muted mt-1">Invites and upcoming sessions</div></div><button className={`toggle ${settings.notifications?"on":""}`} onClick={async()=>{if(!settings.notifications&&"Notification" in window)await Notification.requestPermission();await saveSettings({notifications:!settings.notifications})}}><i/></button></div></section>
    </div>
  </div></main>;
}
