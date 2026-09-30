"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useLab } from "@/components/lab-provider";

export default function InvitePage(){
  const params=useParams<{token:string}>();
  const router=useRouter();
  const {state,loading,busy,command,user}=useLab();
  const supabase=useMemo(()=>createClient(),[]);
  const [done,setDone]=useState(false);
  const [preview,setPreview]=useState<{valid:boolean;inviter_name?:string}|null>(null);

  useEffect(()=>{
    let cancelled=false;
    (async()=>{
      if(!supabase||!params.token)return;
      const {data}=await supabase.rpc("invite_preview",{invite_token:params.token});
      if(!cancelled&&data)setPreview(data as {valid:boolean;inviter_name?:string});
    })();
    return()=>{cancelled=true};
  },[params.token,supabase]);

  if(loading)return<main className="page"><div className="lab-container muted">Opening invitation…</div></main>;

  const loginHref=`/login?next=${encodeURIComponent(`/invite/${params.token}`)}`;
  async function accept(){await command("accept_invite",{token:params.token});setDone(true);setTimeout(()=>router.push("/home"),900)}

  if(!user||!state){
    return <main className="page"><div className="lab-container max-w-2xl"><section className="panel p-8 text-center"><Users className="mx-auto muted"/><p className="eyebrow mt-5">FOCUS PARTNER INVITATION</p><h1 className="text-4xl font-extrabold tracking-[-.045em] mt-3">{preview?.valid?`${preview.inviter_name??"A friend"} invited you to focus together.`:"You’ve been invited to Focus Lab."}</h1><p className="lead mt-3">Create an account or sign in to accept. Your private history and analytics stay private.</p><button className="btn btn-primary mt-6" onClick={()=>router.push(loginHref)}>Continue to sign in <ArrowRight size={16}/></button></section></div></main>
  }

  return <main className="page"><div className="lab-container max-w-2xl"><section className="panel p-8 text-center"><Users className="mx-auto muted"/><p className="eyebrow mt-5">FOCUS PARTNER INVITATION</p><h1 className="text-4xl font-extrabold tracking-[-.045em] mt-3">{done?"You’re connected.":preview?.valid?`${preview.inviter_name??"Your friend"} invited you to focus together.`:"Focus better together."}</h1><p className="lead mt-3">{done?"Your shared Focus Lab is ready.":"Accepting connects you to one private focus partner. You can see each other’s shared-session state, not each other’s private history or analytics."}</p>{state.partner?<button className="btn btn-secondary mt-6" onClick={()=>router.push("/home")}>You already have a partner</button>:!done&&<button className="btn btn-primary mt-6" disabled={busy||preview?.valid===false} onClick={accept}>{busy?"Connecting…":preview?.valid===false?"Invitation expired":"Accept invitation"}</button>}</section></div></main>;
}
