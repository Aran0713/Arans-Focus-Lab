"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Users } from "lucide-react";
import { useLab } from "@/components/lab-provider";

export default function InvitePage(){const params=useParams<{token:string}>();const router=useRouter();const{state,loading,busy,command}=useLab();const[done,setDone]=useState(false);if(loading||!state)return<main className="page"><div className="lab-container muted">Opening invitation…</div></main>;
  async function accept(){await command("accept_invite",{token:params.token});setDone(true);setTimeout(()=>router.push("/home"),900)}
  return <main className="page"><div className="lab-container max-w-2xl"><section className="panel p-8 text-center"><Users className="mx-auto muted"/><p className="eyebrow mt-5">FOCUS PARTNER INVITATION</p><h1 className="text-4xl font-extrabold tracking-[-.045em] mt-3">{done?"You’re connected.":"Focus better together."}</h1><p className="lead mt-3">{done?"Your shared Focus Lab is ready.":"Accepting connects you to one private focus partner. You can see each other’s shared-session state, not each other’s private history or analytics."}</p>{state.partner?<button className="btn btn-secondary mt-6" onClick={()=>router.push("/home")}>You already have a partner</button>:!done&&<button className="btn btn-primary mt-6" disabled={busy} onClick={accept}>{busy?"Connecting…":"Accept invitation"}</button>}</section></div></main>}
