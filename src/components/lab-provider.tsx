"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { LabState, Notice } from "@/lib/types";

type CommandResult = Record<string, unknown> | null;
type OnlineMap = Record<string, boolean>;
type LabContextValue = {
  user: User | null;
  state: LabState | null;
  loading: boolean;
  busy: boolean;
  partnerOnline: OnlineMap;
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
  const [partnerOnline, setPartnerOnline] = useState<OnlineMap>({});
  const [notice, setNotice] = useState<Notice | null>(null);
  const clockOffset = useRef(0);
  const channelsRef = useRef<Map<string, RealtimeChannel>>(new Map());
  const supabase = useMemo(() => createClient(), []);
  const partnersKey = (state?.partners ?? []).map((p) => `${p.id}:${p.partnership_id}`).sort().join("|");
  const roomKey = state?.room?.id ?? "";

  const pushNotice = useCallback((title: string, message?: string, tone: Notice["tone"] = "default", action?: Pick<Notice, "actionLabel" | "actionHref">) => {
    setNotice({ id: crypto.randomUUID(), title, message, tone, ...action });
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
    const targetIds = Array.isArray(payload.partner_ids) ? new Set(payload.partner_ids.filter((v): v is string => typeof v === "string")) : null;
    const enriched = { ...payload, sender_id: user?.id, sender_name: state?.profile?.display_name };
    const sends: Promise<unknown>[] = [];
    for (const [key, channel] of channelsRef.current.entries()) {
      if (targetIds && key.startsWith("partner:") && !targetIds.has(key.slice("partner:".length))) continue;
      sends.push(channel.send({ type: "broadcast", event, payload: enriched }));
    }
    await Promise.allSettled(sends);
  }, [state?.profile?.display_name, user?.id]);

  const command = useCallback(async (action: string, payload: Record<string, unknown> = {}) => {
    if (!supabase) throw new Error("Supabase is not configured.");
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("lab_command", { action, p: payload, request_id: crypto.randomUUID() });
      if (error) { pushNotice("That didn’t work", error.message, "warning"); throw error; }
      await refresh();
      await broadcast("state_changed", { action });
      return data as CommandResult;
    } finally {
      setBusy(false);
    }
  }, [broadcast, pushNotice, refresh, supabase]);

  useEffect(() => {
    refresh();
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange(() => refresh());
    return () => data.subscription.unsubscribe();
  }, [refresh, supabase]);

  useEffect(() => {
    if (!supabase || !user) return;
    const channels = channelsRef.current;
    for (const channel of channels.values()) supabase.removeChannel(channel);
    channels.clear();
    setPartnerOnline({});

    const partners = state?.partners ?? [];
    for (const partner of partners) {
      const key = `partner:${partner.id}`;
      const channel = supabase.channel(`focus-partnership:${partner.partnership_id}`, { config: { presence: { key: user.id } } });
      channels.set(key, channel);
      channel
        .on("presence", { event: "sync" }, () => {
          const presence = channel.presenceState();
          setPartnerOnline((current) => ({ ...current, [partner.id]: Boolean(presence[partner.id]?.length) }));
        })
        .on("broadcast", { event: "state_changed" }, () => refresh())
        .on("broadcast", { event: "focus_invite" }, ({ payload }) => {
          const sender = typeof payload?.sender_name === "string" ? payload.sender_name : partner.name;
          const message = typeof payload?.title === "string" ? payload.title : "A shared room is ready.";
          pushNotice(`${sender} wants to focus`, message, "success", { actionLabel: "Open focus", actionHref: "/focus" });
          if (state?.profile?.settings?.notifications && "Notification" in window && Notification.permission === "granted") {
            new Notification(`${sender} wants to focus`, { body: message, icon: "/icon.svg?v=5" });
          }
          refresh();
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") await channel.track({ online_at: new Date().toISOString(), page: window.location.pathname });
        });
    }

    if (state?.room?.id) {
      const channel = supabase.channel(`focus-room:${state.room.id}`, { config: { presence: { key: user.id } } });
      channels.set(`room:${state.room.id}`, channel);
      channel
        .on("broadcast", { event: "state_changed" }, () => refresh())
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") await channel.track({ online_at: new Date().toISOString(), page: window.location.pathname });
        });
    }

    return () => {
      for (const channel of channels.values()) supabase.removeChannel(channel);
      channels.clear();
    };
  }, [partnersKey, roomKey, pushNotice, refresh, state?.partners, state?.profile?.settings?.notifications, state?.room?.id, supabase, user]);

  useEffect(() => {
    const onFocus = () => refresh();
    const onVisibility = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    const cadence = state?.room && ["waiting", "active"].includes(state.room.status) ? 8_000 : 60_000;
    const timer = window.setInterval(refresh, cadence);
    return () => { window.removeEventListener("focus", onFocus); document.removeEventListener("visibilitychange", onVisibility); clearInterval(timer); };
  }, [refresh, state?.room?.id, state?.room?.status]);

  useEffect(() => {
    const appearance = state?.profile?.settings?.appearance ?? "system";
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const apply = () => {
      const light = appearance === "light" || (appearance === "system" && mq.matches);
      document.documentElement.dataset.theme = light ? "light" : "dark";
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [state?.profile?.settings?.appearance]);

  const value = useMemo<LabContextValue>(() => ({
    user, state, loading, busy, partnerOnline,
    serverNow: () => Date.now() + clockOffset.current,
    refresh, command, broadcast, notice, clearNotice: () => setNotice(null),
  }), [broadcast, busy, command, loading, notice, partnerOnline, refresh, state, user]);

  return <LabContext.Provider value={value}>{children}{notice && <div className="toast panel p-4"><div className="flex gap-3 justify-between"><div><div className="font-bold">{notice.title}</div>{notice.message && <div className="text-sm muted mt-1">{notice.message}</div>}{notice.actionHref&&notice.actionLabel&&<Link className="btn btn-secondary mt-3" href={notice.actionHref} onClick={()=>setNotice(null)}>{notice.actionLabel}</Link>}</div><button className="text-[var(--muted)] self-start" aria-label="Dismiss" onClick={() => setNotice(null)}>×</button></div></div>}</LabContext.Provider>;
}

export function useLab() {
  const value = useContext(LabContext);
  if (!value) throw new Error("useLab must be used inside LabProvider");
  return value;
}
