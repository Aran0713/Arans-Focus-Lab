"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Expand, Loader2, Mic, MicOff, MonitorUp, PhoneOff, ScreenShareOff, Video, VideoOff } from "lucide-react";
import type { DailyCall, DailyParticipant } from "@daily-co/daily-js";
import { useLab } from "@/components/lab-provider";

function ParticipantTile({ participant, compact = false }: { participant: DailyParticipant; compact?: boolean }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [, forceTrackRefresh] = useState(0);
  const videoState = participant.tracks.video;
  const audioState = participant.tracks.audio;
  const videoTrack = videoState.track ?? videoState.persistentTrack ?? null;
  const audioTrack = audioState.track ?? audioState.persistentTrack ?? null;
  const videoOn = Boolean(videoTrack) && (videoState.state === "playable" || videoState.state === "loading");
  const audioOn = Boolean(audioTrack) && (audioState.state === "playable" || audioState.state === "loading");

  useEffect(() => {
    const element = videoRef.current;
    if (!element) return;
    if (!videoTrack || videoTrack.readyState === "ended") {
      element.srcObject = null;
      return;
    }

    const stream = new MediaStream([videoTrack]);
    element.srcObject = stream;
    element.autoplay = true;
    element.muted = true;
    element.playsInline = true;

    const tryPlay = () => {
      void element.play().catch(() => undefined);
    };
    const handleUnmute = () => {
      forceTrackRefresh(value => value + 1);
      tryPlay();
    };

    element.addEventListener("loadedmetadata", tryPlay);
    element.addEventListener("canplay", tryPlay);
    videoTrack.addEventListener("unmute", handleUnmute);
    tryPlay();

    return () => {
      element.removeEventListener("loadedmetadata", tryPlay);
      element.removeEventListener("canplay", tryPlay);
      videoTrack.removeEventListener("unmute", handleUnmute);
      if (element.srcObject === stream) element.srcObject = null;
    };
  }, [videoTrack]);

  useEffect(() => {
    const element = audioRef.current;
    if (!element || participant.local) return;
    if (!audioTrack || audioTrack.readyState === "ended") {
      element.srcObject = null;
      return;
    }

    const stream = new MediaStream([audioTrack]);
    element.srcObject = stream;
    const tryPlay = () => {
      void element.play().catch(() => undefined);
    };
    element.addEventListener("loadedmetadata", tryPlay);
    audioTrack.addEventListener("unmute", tryPlay);
    tryPlay();

    return () => {
      element.removeEventListener("loadedmetadata", tryPlay);
      audioTrack.removeEventListener("unmute", tryPlay);
      if (element.srcObject === stream) element.srcObject = null;
    };
  }, [audioTrack, participant.local]);

  return <div className={`video-tile ${compact ? "compact" : ""} ${participant.local ? "local" : "remote"}`}>
    {videoOn ? <video ref={videoRef} autoPlay playsInline muted /> : <div className="video-placeholder"><div className="video-avatar">{(participant.user_name || "?").trim().charAt(0).toUpperCase()}</div><span>{videoState.state === "loading" ? "Connecting video…" : "Camera off"}</span></div>}
    {!participant.local && <audio ref={audioRef} autoPlay playsInline />}
    <div className="video-name"><span>{participant.local ? "You" : (participant.user_name || "Focus partner")}</span>{!audioOn && <MicOff size={13}/>}</div>
  </div>;
}


function ScreenShareStage({
  participant,
  participants,
}: {
  participant: DailyParticipant;
  participants: DailyParticipant[];
}) {
  const screenRef = useRef<HTMLVideoElement | null>(null);
  const screenAudioRef = useRef<HTMLAudioElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const screenVideoState = participant.tracks.screenVideo;
  const screenAudioState = participant.tracks.screenAudio;
  const screenTrack = screenVideoState.track ?? screenVideoState.persistentTrack ?? null;
  const screenAudioTrack = screenAudioState.track ?? screenAudioState.persistentTrack ?? null;
  const sharerName = participant.local ? "You" : (participant.user_name || "Focus partner");

  useEffect(() => {
    const element = screenRef.current;
    if (!element || !screenTrack || screenTrack.readyState === "ended") return;
    const stream = new MediaStream([screenTrack]);
    element.srcObject = stream;
    element.autoplay = true;
    element.muted = true;
    element.playsInline = true;
    const play = () => void element.play().catch(() => undefined);
    element.addEventListener("loadedmetadata", play);
    element.addEventListener("canplay", play);
    screenTrack.addEventListener("unmute", play);
    play();
    return () => {
      element.removeEventListener("loadedmetadata", play);
      element.removeEventListener("canplay", play);
      screenTrack.removeEventListener("unmute", play);
      if (element.srcObject === stream) element.srcObject = null;
    };
  }, [screenTrack]);

  useEffect(() => {
    const element = screenAudioRef.current;
    if (!element || participant.local || !screenAudioTrack || screenAudioTrack.readyState === "ended") return;
    const stream = new MediaStream([screenAudioTrack]);
    element.srcObject = stream;
    const play = () => void element.play().catch(() => undefined);
    element.addEventListener("loadedmetadata", play);
    screenAudioTrack.addEventListener("unmute", play);
    play();
    return () => {
      element.removeEventListener("loadedmetadata", play);
      screenAudioTrack.removeEventListener("unmute", play);
      if (element.srcObject === stream) element.srcObject = null;
    };
  }, [participant.local, screenAudioTrack]);

  async function fullscreen() {
    try {
      await stageRef.current?.requestFullscreen();
    } catch {}
  }

  return <div className="screen-share-stage" ref={stageRef}>
    <div className="screen-share-status">
      <span className="screen-share-live"><span className="status-dot" />{participant.local ? "You’re sharing your screen" : `${sharerName} is sharing`}</span>
      <button type="button" onClick={fullscreen}><Expand size={14}/>Full screen</button>
    </div>
    {screenTrack ? <video ref={screenRef} className="screen-share-video" autoPlay playsInline muted /> : <div className="screen-share-loading"><Loader2 className="animate-spin" size={20}/>Connecting screen share…</div>}
    {!participant.local && <audio ref={screenAudioRef} autoPlay playsInline />}
    <div className="screen-share-filmstrip">
      {participants.map((person) => <ParticipantTile key={person.session_id} participant={person} compact />)}
    </div>
  </div>;
}

export function VideoPanel({
  roomId,
  embedded = false,
  collapsed = false,
  onExpand,
}: {
  roomId: string;
  embedded?: boolean;
  collapsed?: boolean;
  onExpand?: () => void;
}) {
  const { state } = useLab();
  const [open, setOpen] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState("");
  const [participants, setParticipants] = useState<Record<string, DailyParticipant>>({});
  const [screenShareSupported, setScreenShareSupported] = useState(true);
  const [screenShareBusy, setScreenShareBusy] = useState(false);
  const callRef = useRef<DailyCall | null>(null);
  const canUseVideo = state?.room?.id === roomId && state.room.status === "active";

  const visibleParticipants = useMemo(() => Object.values(participants).filter(Boolean), [participants]);
  const localParticipant = visibleParticipants.find(participant => participant.local);
  const screenSharer = visibleParticipants.find(participant => {
    const track = participant.tracks.screenVideo;
    return Boolean(track.track ?? track.persistentTrack) && (track.state === "playable" || track.state === "loading");
  });
  const cameraOn = localParticipant?.tracks.video.state === "playable";
  const micOn = localParticipant?.tracks.audio.state === "playable";
  const localScreenSharing = Boolean(screenSharer?.local);
  const remoteScreenSharing = Boolean(screenSharer && !screenSharer.local);

  function syncParticipants(call: DailyCall) {
    setParticipants({ ...call.participants() });
  }

  async function stopVideo() {
    const call = callRef.current;
    callRef.current = null;
    if (call) {
      try { await call.leave(); } catch {}
      try { call.destroy(); } catch {}
    }
    setParticipants({});
    setJoined(false);
    setJoining(false);
    setOpen(false);
  }

  async function toggleCamera() {
    const call = callRef.current;
    if (!call || !joined) return;
    try {
      await call.setLocalVideo(!cameraOn);
      syncParticipants(call);
    } catch {
      setError("Couldn’t change the camera. Check browser permissions and try again.");
    }
  }

  async function toggleMic() {
    const call = callRef.current;
    if (!call || !joined) return;
    try {
      await call.setLocalAudio(!micOn);
      syncParticipants(call);
    } catch {
      setError("Couldn’t change the microphone. Check browser permissions and try again.");
    }
  }


  async function toggleScreenShare() {
    const call = callRef.current;
    if (!call || !joined || screenShareBusy) return;
    setScreenShareBusy(true);
    setError("");
    try {
      if (localScreenSharing) {
        await call.stopScreenShare();
      } else if (!remoteScreenSharing) {
        await call.startScreenShare({
          displayMediaOptions: {
            video: true,
            audio: true,
            selfBrowserSurface: "exclude",
            surfaceSwitching: "include",
            systemAudio: "include",
          },
        });
      }
      syncParticipants(call);
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      if (name !== "NotAllowedError" && name !== "AbortError") {
        setError("Screen sharing couldn’t start. Try sharing a browser tab or application window.");
      }
    } finally {
      setScreenShareBusy(false);
    }
  }

  useEffect(() => () => {
    const call = callRef.current;
    callRef.current = null;
    if (call) {
      void call.leave().catch(() => undefined).finally(() => {
        try { call.destroy(); } catch {}
      });
    }
  }, []);

  useEffect(() => {
    if (!open || !canUseVideo || callRef.current) return;
    let cancelled = false;

    (async () => {
      setJoining(true);
      setJoined(false);
      setError("");
      try {
        const response = await fetch("/api/video/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomId }),
        });
        const session = await response.json() as { url?: string; token?: string; error?: string };
        if (!response.ok || !session.url || !session.token) throw new Error(session.error || "Video could not start.");
        if (cancelled) return;

        const mod = await import("@daily-co/daily-js");
        const Daily = mod.default;
        setScreenShareSupported(Boolean(Daily.supportedBrowser().supportsScreenShare));
        const call = Daily.createCallObject();
        callRef.current = call;
        const sync = () => { if (!cancelled) syncParticipants(call); };

        call.on("participant-joined", sync);
        call.on("participant-updated", sync);
        call.on("participant-left", sync);
        call.on("track-started", sync);
        call.on("track-stopped", sync);
        call.on("local-screen-share-started", sync);
        call.on("local-screen-share-stopped", sync);
        call.on("local-screen-share-canceled", sync);
        call.on("joined-meeting", () => {
          if (cancelled) return;
          syncParticipants(call);
          setJoined(true);
          setJoining(false);
        });
        call.on("camera-error", () => {
          if (!cancelled) setError("Camera permission was blocked or the camera is unavailable.");
        });
        call.on("error", (event) => {
          console.error("Daily video error", event);
          if (!cancelled) setError("Video connection failed. Please try again.");
        });
        call.on("left-meeting", () => {
          if (callRef.current === call) callRef.current = null;
          try { call.destroy(); } catch {}
          if (!cancelled) {
            setParticipants({});
            setJoined(false);
            setJoining(false);
            setOpen(false);
          }
        });

        await call.join({ url: session.url, token: session.token });
        if (!cancelled) {
          syncParticipants(call);
          setJoined(true);
          setJoining(false);
        }
      } catch (err) {
        const call = callRef.current;
        callRef.current = null;
        if (call) {
          try { call.destroy(); } catch {}
        }
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Video could not start.");
          setParticipants({});
          setJoined(false);
          setJoining(false);
          setOpen(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [open, roomId, canUseVideo]);

  useEffect(() => {
    if (!canUseVideo && open) void stopVideo();
  }, [canUseVideo, open]);

  if (!canUseVideo) return null;

  if (collapsed) {
    return <div className="video-collapsed-bar">
      <div><span className={`status-dot ${joined ? "" : "offline"}`}/><b>{joined ? "Video is still connected" : "Video panel hidden"}</b><span>{joined ? (cameraOn ? "Camera on" : "Camera off") : "Open it whenever you want."}</span></div>
      <div className="flex gap-2 flex-wrap">
        <button className="btn btn-secondary btn-small" type="button" onClick={onExpand}>Show video</button>
        {joined && <button className="btn btn-ghost btn-small" type="button" onClick={stopVideo}>Leave video</button>}
      </div>
    </div>;
  }

  if (!open) return <div className={embedded ? "video-launch workspace-video-launch" : "video-launch"}><div><b>Optional video</b><span>Turn it on when seeing each other helps you stay accountable.</span></div><button className="btn btn-secondary" onClick={() => setOpen(true)}><Camera size={17}/>Start video</button>{error&&<span className="text-xs text-[var(--red)]">{error}</span>}</div>;

  return <section className={`video-panel panel ${embedded ? "video-panel-embedded" : ""}`}>
    {!embedded && <div className="video-panel-head"><div><p className="eyebrow">OPTIONAL VIDEO</p><div className="font-bold mt-1">Quiet accountability, without leaving your focus room.</div></div>{joined&&<div className="video-presence"><span className="status-dot"/>{visibleParticipants.length} {visibleParticipants.length===1?"person":"people"}</div>}</div>}
    {joining ? <div className="video-loading"><Loader2 className="animate-spin" size={22}/><span>Connecting camera and microphone…</span></div> : screenSharer ? <ScreenShareStage participant={screenSharer} participants={visibleParticipants} /> : <div className={`video-grid ${visibleParticipants.length<=1?"single":"multi"}`}>{visibleParticipants.map(participant=><ParticipantTile key={participant.session_id} participant={participant}/>)}</div>}
    <div className="video-controls">
      <button className={`video-control ${cameraOn?"active":""}`} onClick={toggleCamera} disabled={!joined}>{cameraOn?<Video size={18}/>:<VideoOff size={18}/>}<span>{cameraOn?"Camera on":"Camera off"}</span></button>
      <button className={`video-control ${micOn?"active":""}`} onClick={toggleMic} disabled={!joined}>{micOn?<Mic size={18}/>:<MicOff size={18}/>}<span>{micOn?"Mic on":"Mic off"}</span></button>
      <button
        className={`video-control screen-share-control ${localScreenSharing ? "sharing" : ""}`}
        onClick={toggleScreenShare}
        disabled={!joined || !screenShareSupported || screenShareBusy || remoteScreenSharing}
        title={!screenShareSupported ? "Screen sharing isn’t supported in this browser." : remoteScreenSharing ? `${screenSharer?.user_name || "Your focus partner"} is already sharing.` : undefined}
      >
        {screenShareBusy ? <Loader2 className="animate-spin" size={18}/> : localScreenSharing ? <ScreenShareOff size={18}/> : <MonitorUp size={18}/>}
        <span>{localScreenSharing ? "Stop sharing" : remoteScreenSharing ? "Viewing share" : "Share screen"}</span>
      </button>
      <button className="video-control leave" onClick={stopVideo}><PhoneOff size={18}/><span>Leave video</span></button>
    </div>
    {error&&<div className="video-error">{error}</div>}
  </section>;
}
