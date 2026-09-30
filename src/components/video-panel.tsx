"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Loader2, X } from "lucide-react";
import type { DailyCall } from "@daily-co/daily-js";

export function VideoPanel({ roomId }: { roomId: string }) {
  const [open, setOpen] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const callRef = useRef<DailyCall | null>(null);

  async function stopVideo() {
    const call = callRef.current;
    callRef.current = null;
    if (call) {
      try { await call.leave(); } catch {}
      try { call.destroy(); } catch {}
    }
    setOpen(false);
    setJoining(false);
  }

  useEffect(() => () => {
    const call = callRef.current;
    callRef.current = null;
    if (call) {
      try { call.leave(); } catch {}
      try { call.destroy(); } catch {}
    }
  }, []);

  useEffect(() => {
    if (!open || !containerRef.current || callRef.current) return;
    let cancelled = false;

    (async () => {
      setJoining(true);
      setError("");
      try {
        const response = await fetch("/api/video/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomId }),
        });
        const session = await response.json() as { url?: string; token?: string; error?: string };
        if (!response.ok || !session.url || !session.token) throw new Error(session.error || "Video could not start.");
        if (cancelled || !containerRef.current) return;

        const mod = await import("@daily-co/daily-js");
        const Daily = mod.default;
        const call = Daily.createFrame(containerRef.current, {
          showLeaveButton: true,
          showFullscreenButton: true,
          iframeStyle: {
            width: "100%",
            height: "100%",
            border: "0",
            borderRadius: "16px",
          },
        });
        callRef.current = call;
        // Daily Prebuilt may need to show its permission/prejoin UI before join resolves.
        // Do not keep our loading layer over that UI or the user cannot interact with it.
        setJoining(false);
        call.on("left-meeting", () => {
          callRef.current = null;
          try { call.destroy(); } catch {}
          setOpen(false);
          setJoining(false);
        });
        call.on("error", (event) => {
          console.error("Daily video error", event);
          setError("Camera connection failed. Check browser camera/microphone permissions and try again.");
        });
        await call.join({ url: session.url, token: session.token });
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Video could not start.");
          setOpen(false);
        }
      } finally {
        if (!cancelled) setJoining(false);
      }
    })();

    return () => { cancelled = true; };
  }, [open, roomId]);

  if (!open) return <div className="video-launch"><button className="btn btn-secondary" onClick={() => setOpen(true)}><Camera size={17}/>Turn camera on</button>{error&&<span className="text-xs text-[var(--red)]">{error}</span>}</div>;

  return <section className="video-panel panel">
    <div className="video-panel-head"><div><p className="eyebrow">OPTIONAL VIDEO</p><div className="font-bold mt-1">Stay present without making video mandatory.</div></div><button className="icon-btn" aria-label="Close video" onClick={stopVideo}><X size={17}/></button></div>
    <div className="video-frame" ref={containerRef}>{joining&&<div className="video-loading"><Loader2 className="animate-spin" size={22}/><span>Connecting camera and microphone…</span></div>}</div>
    <div className="video-panel-foot"><span className="text-xs muted">Video can disconnect without affecting timers, goals, or the shared room.</span><button className="btn btn-ghost btn-small" onClick={stopVideo}><CameraOff size={15}/>Leave video</button></div>
  </section>;
}
