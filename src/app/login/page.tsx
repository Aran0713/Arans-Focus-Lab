"use client";

import { FormEvent, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { Brand } from "@/components/brand";

export default function LoginPage() {
  const supabase = useMemo(() => createClient(), []);
  const params = useSearchParams();
  const [mode, setMode] = useState<"signin"|"signup">("signin");
  const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [name,setName]=useState(""); const [message,setMessage]=useState(""); const [busy,setBusy]=useState(false);
  const next = params.get("next") || "/home";
  async function submit(e:FormEvent){e.preventDefault();if(!supabase)return;setBusy(true);setMessage("");
    if(mode==="signup"){
      const {error}=await supabase.auth.signUp({email,password,options:{data:{display_name:name||"Focus friend"},emailRedirectTo:`${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`}});
      if(error)setMessage(error.message);else setMessage("Account created. If email confirmation is enabled, check your inbox, then sign in.");
    }else{
      const {error}=await supabase.auth.signInWithPassword({email,password});
      if(error)setMessage(error.message);else window.location.assign(next);
    }setBusy(false);
  }
  async function google(){if(!supabase)return;await supabase.auth.signInWithOAuth({provider:"google",options:{redirectTo:`${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`}})}
  return <main className="login-page"><div className="login-grid lab-container"><section className="login-story"><Brand/><div><p className="eyebrow">SHOW UP. DO THE WORK.</p><h1 className="display-title">Focus that tells the truth.</h1><p className="lead max-w-xl">Track real focus separately from breaks, keep your momentum visible, and work beside one trusted focus partner without turning productivity into social media.</p></div><div className="quote-line">Show up → Focus → Take honest breaks → Finish → See actual effort → Improve</div></section><section className="auth-card panel"><p className="eyebrow">PRIVATE FOCUS SPACE</p><h2 className="text-3xl font-extrabold mt-2">{mode==="signin"?"Welcome back":"Create your Focus Lab"}</h2><p className="muted mt-2">Email and password. No public profile. No feed.</p>{!isSupabaseConfigured&&<div className="error-box mt-5">Supabase environment variables still need to be configured.</div>}<form onSubmit={submit} className="mt-6 space-y-4">{mode==="signup"&&<label className="field"><span>Name</span><input value={name} onChange={e=>setName(e.target.value)} placeholder="Aran" maxLength={80}/></label>}<label className="field"><span>Email</span><input value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="you@example.com" required/></label><label className="field"><span>Password</span><input value={password} onChange={e=>setPassword(e.target.value)} type="password" minLength={6} required/></label><button disabled={busy||!isSupabaseConfigured} className="btn btn-primary w-full" type="submit">{busy?"Working…":mode==="signin"?"Sign in":"Create account"}</button></form><div className="auth-divider"><span>or</span></div><button className="btn btn-secondary w-full" onClick={google} disabled={!isSupabaseConfigured}>Continue with Google</button>{message&&<div className="info-box mt-4">{message}</div>}<button onClick={()=>setMode(mode==="signin"?"signup":"signin")} className="text-sm muted mt-5 hover:text-[var(--text)]">{mode==="signin"?"New here? Create an account":"Already have an account? Sign in"}</button></section></div></main>
}
