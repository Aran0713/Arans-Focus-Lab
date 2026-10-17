"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, LockKeyhole, Target } from "lucide-react";
import { Brand } from "@/components/brand";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { guestFocusModeLabel, readGuestFocusDraft, type GuestFocusDraft } from "@/lib/guest-focus";

export function StartGate() {
  const supabase = useMemo(() => createClient(), []);
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [draft, setDraft] = useState<GuestFocusDraft | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDraft(readGuestFocusDraft());
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setMessage("");
    const next = "/focus?trial=1";

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
      });
      if (error) {
        setMessage(error.message);
      } else if (data.session) {
        window.location.assign(next);
        return;
      } else {
        setMessage("Check your email to confirm your account. Your focus plan is saved on this device and will continue when you come back.");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMessage(error.message);
      else {
        window.location.assign(next);
        return;
      }
    }
    setBusy(false);
  }

  return <main className="start-gate-page">
    <div className="lab-container start-gate-grid">
      <section className="start-gate-context">
        <Brand />
        <Link href="/" className="start-back"><ArrowLeft size={15}/>Edit my session</Link>
        <div>
          <p className="eyebrow">YOUR SESSION IS READY</p>
          <h1>{draft?.title || "Start your first honest focus session."}</h1>
          <p className="lead">Create an account now so Focus Lab can save your timer, breaks, stats, and future sessions.</p>
        </div>

        <div className="panel start-draft-card">
          <div className="start-draft-title"><Target size={18}/><span><small>Focus on</small><b>{draft?.title || "Your planned session"}</b></span></div>
          <div className="start-draft-meta">
            <span><small>Mode</small><b>{draft ? guestFocusModeLabel(draft) : "Open-ended"}</b></span>
            <span><small>Goals</small><b>{draft?.goals.length ?? 0}</b></span>
          </div>
          {draft?.goals.length ? <div className="start-draft-goals">{draft.goals.map((goal,index)=><div key={`${goal}-${index}`}><Check size={13}/>{goal}</div>)}</div> : null}
        </div>

        <div className="start-trust"><LockKeyhole size={16}/><span><b>Private by default.</b> No public profile, no feed, no credit card.</span></div>
      </section>

      <section className="auth-card panel start-auth-card">
        <p className="eyebrow">{mode === "signup" ? "ONE QUICK STEP" : "WELCOME BACK"}</p>
        <h2>{mode === "signup" ? "Save it and start." : "Sign in and start."}</h2>
        <p className="muted mt-2">{mode === "signup" ? "Just email and password. You can add a display name later if you use focus partners." : "Your saved session will continue after sign in."}</p>

        {!isSupabaseConfigured && <div className="error-box mt-5">Focus Lab is temporarily unavailable. Please try again shortly.</div>}

        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="field"><span>Email</span><input value={email} onChange={(e)=>setEmail(e.target.value)} type="email" autoComplete="email" placeholder="you@example.com" required/></label>
          <label className="field"><span>Password</span><input value={password} onChange={(e)=>setPassword(e.target.value)} type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={6} required/></label>
          <button disabled={busy || !isSupabaseConfigured} className="btn btn-primary w-full start-account-button" type="submit">
            {busy ? "Working…" : mode === "signup" ? "Create account & start focus" : "Sign in & start focus"}
          </button>
        </form>

        {message && <div className="info-box mt-4">{message}</div>}

        <button type="button" onClick={()=>{setMode(mode === "signup" ? "signin" : "signup");setMessage("")}} className="start-auth-switch">
          {mode === "signup" ? "Already have an account? Sign in" : "New here? Create a free account"}
        </button>
      </section>
    </div>
  </main>;
}
