"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, FileText, Image as ImageIcon, Link2, Loader2, MessageCircle, Paperclip, Send, Target, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { FocusRoom, RoomMessage, RoomMessageAttachment } from "@/lib/types";

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = new Set(["pdf","png","jpg","jpeg","gif","webp","txt","md","csv","doc","docx","ppt","pptx","xls","xlsx","zip"]);
const ACCEPT = ".pdf,.png,.jpg,.jpeg,.gif,.webp,.txt,.md,.csv,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip";
const URL_RE = /(https?:\/\/[^\s]+)/g;

type ChatTab = "chat" | "files" | "links" | "goals";
type MessageWithFiles = RoomMessage & { attachments: RoomMessageAttachment[] };

function safeFileName(name: string) {
  const cleaned = name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
  return cleaned.slice(-120) || "file";
}

function fileExtension(name: string) {
  const bit = name.split(".").pop();
  return bit ? bit.toLowerCase() : "";
}

function linkify(text: string) {
  return text.split(URL_RE).map((part, index) => {
    if (/^https?:\/\//i.test(part)) {
      const clean = part.replace(/[),.;!?]+$/, "");
      const suffix = part.slice(clean.length);
      return <span key={index}><a className="chat-link" href={clean} target="_blank" rel="noopener noreferrer">{clean}</a>{suffix}</span>;
    }
    return <span key={index}>{part}</span>;
  });
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";
}

export function RoomChat({
  room,
  visible,
  onClose,
  onUnreadChange,
}: {
  room: FocusRoom;
  visible: boolean;
  onClose: () => void;
  onUnreadChange?: (count: number) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [tab, setTab] = useState<ChatTab>("chat");
  const [messages, setMessages] = useState<MessageWithFiles[]>([]);
  const [draft, setDraft] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [unread, setUnread] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const memberNames = useMemo(() => new Map(room.members.map((member) => [member.user_id, member.name])), [room.members]);

  const loadMessages = useCallback(async () => {
    if (!supabase) return;
    const { data: rows, error: messageError } = await supabase
      .from("room_messages")
      .select("id,room_id,sender_id,body,created_at")
      .eq("room_id", room.id)
      .order("created_at", { ascending: true })
      .limit(250);
    if (messageError) {
      setError(messageError.message);
      setLoading(false);
      return;
    }

    const ids = (rows ?? []).map((message) => message.id);
    let attachments: RoomMessageAttachment[] = [];
    if (ids.length) {
      const { data: attachmentRows, error: attachmentError } = await supabase
        .from("room_message_attachments")
        .select("id,message_id,room_id,uploader_id,storage_path,file_name,mime_type,size_bytes,created_at")
        .in("message_id", ids)
        .order("created_at", { ascending: true });
      if (attachmentError) {
        setError(attachmentError.message);
      } else {
        attachments = (attachmentRows ?? []) as RoomMessageAttachment[];
      }
    }

    const byMessage = new Map<string, RoomMessageAttachment[]>();
    for (const attachment of attachments) {
      const list = byMessage.get(attachment.message_id) ?? [];
      list.push(attachment);
      byMessage.set(attachment.message_id, list);
    }

    const withFiles = (rows ?? []).map((message) => ({
      ...(message as RoomMessage),
      attachments: byMessage.get(message.id) ?? [],
    }));
    setMessages(withFiles);
    setLoading(false);
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, [room.id, supabase]);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, [supabase]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel(`room-chat:${room.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "room_messages", filter: `room_id=eq.${room.id}` }, (payload) => {
        const sender = typeof payload.new?.sender_id === "string" ? payload.new.sender_id : "";
        if (sender && sender !== userId && (!visible || tab !== "chat")) setUnread((count) => count + 1);
        void loadMessages();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "room_message_attachments", filter: `room_id=eq.${room.id}` }, () => {
        void loadMessages();
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [loadMessages, room.id, supabase, tab, userId, visible]);

  useEffect(() => {
    if (visible && tab === "chat") setUnread(0);
  }, [tab, visible]);

  useEffect(() => {
    onUnreadChange?.(unread);
  }, [onUnreadChange, unread]);

  function chooseFiles(event: ChangeEvent<HTMLInputElement>) {
    setError("");
    const next = Array.from(event.target.files ?? []);
    event.target.value = "";
    const accepted: File[] = [];
    for (const file of next) {
      if (!ACCEPTED_EXTENSIONS.has(fileExtension(file.name))) {
        setError("That file type isn’t supported yet.");
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        setError(`${file.name} is larger than 20 MB.`);
        continue;
      }
      accepted.push(file);
    }
    setPendingFiles((current) => [...current, ...accepted].slice(0, 5));
  }

  async function signedUrl(path: string) {
    if (!supabase) return null;
    const { data, error: signedError } = await supabase.storage.from("focus-room-files").createSignedUrl(path, 60 * 60);
    if (signedError) {
      setError(signedError.message);
      return null;
    }
    return data.signedUrl;
  }

  async function openAttachment(attachment: RoomMessageAttachment) {
    const url = await signedUrl(attachment.storage_path);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !userId || sending) return;
    const body = draft.trim();
    if (!body && pendingFiles.length === 0) return;
    setSending(true);
    setError("");
    const messageId = crypto.randomUUID();
    const uploadedPaths: string[] = [];

    try {
      const attachmentRows: RoomMessageAttachment[] = [];
      for (const file of pendingFiles) {
        const attachmentId = crypto.randomUUID();
        const path = `${room.id}/${userId}/${messageId}/${attachmentId}-${safeFileName(file.name)}`;
        const { error: uploadError } = await supabase.storage.from("focus-room-files").upload(path, file, {
          cacheControl: "3600",
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });
        if (uploadError) throw uploadError;
        uploadedPaths.push(path);
        attachmentRows.push({
          id: attachmentId,
          message_id: messageId,
          room_id: room.id,
          uploader_id: userId,
          storage_path: path,
          file_name: file.name.slice(0, 180),
          mime_type: file.type || "application/octet-stream",
          size_bytes: file.size,
          created_at: new Date().toISOString(),
        });
      }

      const { error: messageError } = await supabase.from("room_messages").insert({
        id: messageId,
        room_id: room.id,
        sender_id: userId,
        body,
      });
      if (messageError) throw messageError;

      if (attachmentRows.length) {
        const { error: attachmentError } = await supabase.from("room_message_attachments").insert(
          attachmentRows.map(({ created_at, ...row }) => row)
        );
        if (attachmentError) {
          await supabase.from("room_messages").delete().eq("id", messageId);
          throw attachmentError;
        }
      }

      setDraft("");
      setPendingFiles([]);
      await loadMessages();
    } catch (err) {
      if (uploadedPaths.length) await supabase.storage.from("focus-room-files").remove(uploadedPaths);
      setError(err instanceof Error ? err.message : "Message could not be sent.");
    } finally {
      setSending(false);
    }
  }

  const files = useMemo(() => messages.flatMap((message) => message.attachments.map((attachment) => ({ attachment, message }))), [messages]);
  const links = useMemo(() => messages.flatMap((message) => {
    const matches = message.body.match(URL_RE) ?? [];
    return matches.map((url) => ({ url: url.replace(/[),.;!?]+$/, ""), message }));
  }), [messages]);

  const tabs: Array<{ id: ChatTab; label: string; icon: typeof MessageCircle; count?: number }> = [
    { id: "chat", label: "Chat", icon: MessageCircle },
    { id: "files", label: "Files", icon: FileText, count: files.length },
    { id: "links", label: "Links", icon: Link2, count: links.length },
    { id: "goals", label: "Goals", icon: Target },
  ];

  return (
    <section className="room-chat panel" aria-label="Shared room chat">
      <div className="room-chat-head">
        <div className="room-chat-tabs">
          {tabs.map(({ id, label, count }) => (
            <button key={id} type="button" className={tab === id ? "active" : ""} onClick={() => setTab(id)}>
              {label}{typeof count === "number" && count > 0 ? <span>{count}</span> : null}
            </button>
          ))}
        </div>
        <button className="room-chat-close" type="button" aria-label="Hide chat" onClick={onClose}><X size={17} /></button>
      </div>

      {tab === "chat" && (
        <>
          <div className="room-chat-scroll" ref={scrollRef}>
            {loading ? <div className="room-chat-empty"><Loader2 className="animate-spin" size={19} />Loading messages…</div> : messages.length === 0 ? (
              <div className="room-chat-empty"><MessageCircle size={24} /><b>Quiet room, for now.</b><span>Send a quick note, link, image, or study file without leaving focus.</span></div>
            ) : messages.map((message) => {
              const mine = message.sender_id === userId;
              const name = mine ? "You" : (memberNames.get(message.sender_id) ?? "Focus partner");
              return (
                <div className={`room-message ${mine ? "mine" : ""}`} key={message.id}>
                  {!mine && <div className="room-message-avatar">{initials(name)}</div>}
                  <div className="room-message-content">
                    {!mine && <div className="room-message-name">{name}</div>}
                    {message.body && <div className="room-message-bubble">{linkify(message.body)}</div>}
                    {message.attachments.map((attachment) => {
                      const image = attachment.mime_type.startsWith("image/");
                      return <button type="button" className="room-message-file" key={attachment.id} onClick={() => openAttachment(attachment)}>
                        <span className="room-message-file-icon">{image ? <ImageIcon size={18} /> : <FileText size={18} />}</span>
                        <span><b>{attachment.file_name}</b><small>{formatBytes(attachment.size_bytes)}</small></span>
                        <Download size={15} />
                      </button>;
                    })}
                    <time>{new Date(message.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time>
                  </div>
                </div>
              );
            })}
          </div>

          <form className="room-chat-compose" onSubmit={send}>
            {pendingFiles.length > 0 && <div className="room-chat-pending">{pendingFiles.map((file, index) => <div key={`${file.name}-${index}`}><Paperclip size={13} /><span>{file.name}</span><button type="button" aria-label={`Remove ${file.name}`} onClick={() => setPendingFiles((current) => current.filter((_, i) => i !== index))}><X size={13} /></button></div>)}</div>}
            {error && <div className="room-chat-error">{error}</div>}
            <div className="room-chat-compose-row">
              <input ref={fileInputRef} hidden type="file" multiple accept={ACCEPT} onChange={chooseFiles} />
              <button type="button" className="room-chat-attach" aria-label="Attach files" onClick={() => fileInputRef.current?.click()} disabled={sending}><Paperclip size={18} /></button>
              <textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Write a message…" maxLength={4000} rows={1} onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }} />
              <button type="submit" className="room-chat-send" aria-label="Send message" disabled={sending || (!draft.trim() && pendingFiles.length === 0)}>{sending ? <Loader2 className="animate-spin" size={17} /> : <Send size={18} />}</button>
            </div>
            <div className="room-chat-hint">Enter to send · Shift+Enter for a new line · up to 5 files, 20 MB each</div>
          </form>
        </>
      )}

      {tab === "files" && <div className="room-chat-library">
        {files.length ? files.map(({ attachment, message }) => <button type="button" className="room-library-row" key={attachment.id} onClick={() => openAttachment(attachment)}>
          <span className="room-message-file-icon">{attachment.mime_type.startsWith("image/") ? <ImageIcon size={18} /> : <FileText size={18} />}</span>
          <span><b>{attachment.file_name}</b><small>{memberNames.get(message.sender_id) ?? "You"} · {formatBytes(attachment.size_bytes)}</small></span>
          <Download size={15} />
        </button>) : <div className="room-chat-empty"><FileText size={24} /><b>No files yet.</b><span>Files shared in chat will collect here automatically.</span></div>}
      </div>}

      {tab === "links" && <div className="room-chat-library">
        {links.length ? links.map(({ url, message }, index) => <a className="room-library-row" href={url} target="_blank" rel="noopener noreferrer" key={`${message.id}-${index}`}>
          <span className="room-message-file-icon"><Link2 size={18} /></span>
          <span><b>{url}</b><small>{memberNames.get(message.sender_id) ?? "You"}</small></span>
        </a>) : <div className="room-chat-empty"><Link2 size={24} /><b>No links yet.</b><span>Useful links shared in chat will stay easy to find.</span></div>}
      </div>}

      {tab === "goals" && <div className="room-chat-library room-chat-goals">
        {room.members.filter((member) => member.is_present).map((member) => {
          const goals = [...(member.session?.goals ?? [])].sort((a, b) => a.position - b.position);
          return <div className="room-chat-goal-person" key={member.user_id}>
            <div><b>{member.user_id === userId ? "You" : member.name}</b><span>{member.session?.title || member.title || "Shared focus"}</span></div>
            {goals.length ? goals.map((goal) => <div className={`room-chat-goal ${goal.completed ? "done" : ""}`} key={goal.id}><span>{goal.completed ? "✓" : ""}</span>{goal.text}</div>) : <div className="muted text-sm">No goals added yet.</div>}
          </div>;
        })}
      </div>}
    </section>
  );
}
