"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { LabState, Notice } from "@/lib/types";

type CommandResult = Record<string, unknown> | null;
type LabContextValue = {
  user: User | null;
  state: LabState | null;
  loading: boolean;
  busy: boolean;
  partnerOnline: boolean;
  serverNow: () => number;
  refresh: () => Promise<void>;
  command: (action: string, payload?: Record<string, unknown>) => Promise<CommandResult>;
  broadcast: (event: string, payload?: Record<string, unknown>) => Promise<void>;
  notice: Notice | null;
  clearNotice: () => void;
};

const LabContext = createContext<LabContextValue | null>(null);

export function LabProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [state, setState] = useState<LabState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [partnerOnline, setPartnerOnline] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const clockOffset = useRef(0);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const supabase = useMemo(() => createClient(), []);

  const pushNotice = useCallback((title: string, message?: string, tone: Notice["tone"] = "default") => {
    setNotice({ id: crypto.randomUUID(), title, message, tone });
  }, []);

  const refresh = useCallback(async () => {
    if (!supabase) { setLoading(false); return; }
    const { data: auth } = await supabase.auth.getUser();
    setUser(auth.user);
    if (!auth.user) { setState(null); setLoading(false); return; }
    const { data, error } = await supabase.rpc("lab_state");
    if (error) { pushNotice("Couldn’t refresh Focus Lab", error.message, "warning"); setLoading(false); return; }
    const next = data as unknown as LabState;
    setState(next);
    clockOffset.current = new Date(next.server_now).getTime() - Date.now();
    setLoading(false);
  }, [pushNotice, supabase]);

  const broadcast = useCallback(async (event: string, payload: Record<string, unknown> = {}) => {
    if (!channelRef.current) return;
    await channelRef.current.send({ type: "broadcast", event, payload });
  }, []);

  const command = useCallback(async (action: string, payload: Record<string, unknown> = {}) => {
    if (!supabase) throw new Error("Supabase is not configured.");
    setBusy(true);
    const { data, error } = await supabase.rpc("lab_command", { action, p: payload, request_id: crypto.randomUUID() });
    if (error) { setBusy(false); pushNotice("That didn’t work", error.message, "warning"); throw error; }
    await refresh();
    await broadcast("state_changed", { action });
    setBusy(false);
    return data as CommandResult;
  }, [broadcast, pushNotice, refresh, supabase]);

  useEffect(() => {
    refresh();
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange(() => refresh());
    return () => data.subscription.unsubscribe();
  }, [refresh, supabase]);

  useEffect(() => {
    if (!supabase || !state?.partner?.partnership_id || !user) { setPartnerOnline(false); return; }
    const channel = supabase.channel(`focus-partnership:${state.partner.partnership_id}`, { config: { presence: { key: user.id } } });
    channelRef.current = channel;
    channel
      .on("presence", { event: "sync" }, () => {
        const presence = channel.presenceState();
        setPartnerOnline(Boolean(state.partner && presence[state.partner.id]?.length));
      })
      .on("broadcast", { event: "state_changed" }, () => refresh())
      .on("broadcast", { event: "focus_invite" }, ({ payload }) => {
        pushNotice(`${state.partner?.name ?? "Your focus partner"} wants to focus`, typeof payload?.title === "string" ? payload.title : undefined, "success");
        refresh();
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") await channel.track({ online_at: new Date().toISOString(), page: window.location.pathname });
      });
    return () => { channelRef.current = null; supabase.removeChannel(channel); };
  }, [pushNotice, refresh, state?.partner?.id, state?.partner?.name, state?.partner?.partnership_id, supabase, user]);

  useEffect(() => {
    const onFocus = () => refresh();
    const onVisibility = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    const timer = window.setInterval(refresh, 60_000);
    return () => { window.removeEventListener("focus", onFocus); document.removeEventListener("visibilitychange", onVisibility); clearInterval(timer); };
  }, [refresh]);

  useEffect(() => {
    const appearance = state?.profile?.settings?.appearance ?? "system";
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const apply = () => {
      const light = appearance === "light" || (appearance === "system" && mq.matches);
      document.documentElement.dataset.theme = light ? "light" : "dark";
    };
    apply(); mq.addEventListener("change", apply); return () => mq.removeEventListener("change", apply);
  }, [state?.profile?.settings?.appearance]);

  const value = useMemo<LabContextValue>(() => ({
    user, state, loading, busy, partnerOnline,
    serverNow: () => Date.now() + clockOffset.current,
    refresh, command, broadcast, notice, clearNotice: () => setNotice(null),
  }), [broadcast, busy, command, loading, notice, partnerOnline, refresh, state, user]);

  return <LabContext.Provider value={value}>{children}{notice && <div className="toast panel p-4"><div className="flex gap-3 justify-between"><div><div className="font-bold">{notice.title}</div>{notice.message && <div className="text-sm muted mt-1">{notice.message}</div>}</div><button className="text-[var(--muted)]" aria-label="Dismiss" onClick={() => setNotice(null)}>×</button></div></div>}</LabContext.Provider>;
}

export function useLab() {
  const value = useContext(LabContext);
  if (!value) throw new Error("useLab must be used inside LabProvider");
  return value;
}
