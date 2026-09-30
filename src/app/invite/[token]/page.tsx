"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function InvitePage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!supabase) { setLoading(false); return; }
      const { data } = await supabase.auth.getUser();
      if (!cancelled) { setUserId(data.user?.id ?? null); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [supabase]);

  async function accept() {
    if (!supabase) return;
    setBusy(true); setMessage("");
    const { error } = await supabase.rpc("lab_command", {
      action: "accept_invite",
      p: { token: params.token },
      request_id: crypto.randomUUID(),
    });
    if (error) { setMessage(error.message); setBusy(false); return; }
    router.push("/home");
    router.refresh();
  }

  if (loading) return <main className="login-page"><div className="muted">Opening invitation…</div></main>;

  const next = `/invite/${params.token}`;
  return <main className="login-page"><div className="lab-container max-w-2xl"><section className="panel p-8 sm:p-10 text-center"><Users className="mx-auto muted" size={30}/><p className="eyebrow mt-5">FOCUS PARTNER INVITATION</p><h1 className="text-4xl sm:text-5xl font-extrabold tracking-[-.045em] mt-3">Focus better together.</h1><p className="lead mt-4">You’ve been invited to connect as a private focus partner. You can share live session status and goals when you deliberately join the same room — private history, analytics, and other partner connections stay private.</p>{message&&<div className="error-box mt-5 text-left">{message}</div>}{userId?<button className="btn btn-primary mt-7" disabled={busy} onClick={accept}>{busy?"Connecting…":"Accept invitation"}</button>:<button className="btn btn-primary mt-7" onClick={()=>router.push(`/login?next=${encodeURIComponent(next)}`)}>Sign in or create an account <ArrowRight size={16}/></button>}<p className="text-xs muted mt-5">The invitation is single-use, expires automatically, and each account can connect up to three focus partners.</p></section></div></main>;
}
