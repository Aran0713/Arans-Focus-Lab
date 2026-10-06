import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const DAILY_API = "https://api.daily.co/v1";
type VideoAccess = { room_id: string; status: string; user_id: string; user_name: string; member_count: number };

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const apiKey = process.env.DAILY_API_KEY;
  const domain = (process.env.NEXT_PUBLIC_DAILY_DOMAIN || "").replace(/\/$/, "");
  if (!apiKey || !domain) return jsonError("Video is not configured yet.", 503);

  const body = await request.json().catch(() => null) as { roomId?: string } | null;
  if (!body?.roomId) return jsonError("Missing focus room.");

  const supabase = await createClient();
  if (!supabase) return jsonError("Authentication is not configured.", 503);
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return jsonError("Please sign in.", 401);

  const { data, error: accessError } = await supabase.rpc("video_access", { room_id: body.roomId });
  if (accessError || !data) return jsonError(accessError?.message || "You do not have access to this room.", 403);
  const access = data as unknown as VideoAccess;
  if (access.member_count < 2 || access.member_count > 6) return jsonError("This room cannot start video.", 403);

  const roomName = `focus-${body.roomId.replace(/-/g, "")}`;
  const headers = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
  const nowSeconds = Math.floor(Date.now() / 1000);

  const existing = await fetch(`${DAILY_API}/rooms/${roomName}`, { headers, cache: "no-store" });
  if (existing.status === 404) {
    const created = await fetch(`${DAILY_API}/rooms`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: roomName,
        privacy: "private",
        properties: {
          exp: nowSeconds + 8 * 60 * 60,
          max_participants: 6,
          enable_people_ui: true,
          enable_prejoin_ui: true,
          enable_chat: false,
          enable_screenshare: true,
          enable_recording: false,
          start_video_off: false,
          eject_at_room_exp: true,
        },
      }),
    });
    if (!created.ok) {
      const detail = await created.text();
      console.error("Daily room creation failed", created.status, detail);
      return jsonError("Couldn’t start video right now.", 502);
    }
  } else if (existing.ok) {
    // Preview feature: ensure existing focus rooms also allow screen sharing.
    const updated = await fetch(`${DAILY_API}/rooms/${roomName}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ properties: { enable_screenshare: true, max_participants: 6 } }),
    });
    if (!updated.ok) {
      const detail = await updated.text();
      console.error("Daily room screen-share update failed", updated.status, detail);
      return jsonError("Couldn’t enable screen sharing right now.", 502);
    }
  } else if (!existing.ok) {
    const detail = await existing.text();
    console.error("Daily room lookup failed", existing.status, detail);
    return jsonError("Couldn’t reach the video service.", 502);
  }

  const tokenResponse = await fetch(`${DAILY_API}/meeting-tokens`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      properties: {
        room_name: roomName,
        exp: nowSeconds + 3 * 60 * 60,
        eject_at_token_exp: true,
        is_owner: false,
        user_name: access.user_name,
        user_id: access.user_id,
        enable_screenshare: true,
        enable_recording: false,
        start_video_off: false,
        start_cloud_recording: false,
      },
    }),
  });

  if (!tokenResponse.ok) {
    const detail = await tokenResponse.text();
    console.error("Daily meeting token failed", tokenResponse.status, detail);
    return jsonError("Couldn’t authorize video right now.", 502);
  }

  const tokenData = await tokenResponse.json() as { token?: string };
  if (!tokenData.token) return jsonError("Video authorization returned no token.", 502);

  return NextResponse.json({ url: `${domain}/${roomName}`, token: tokenData.token, roomName });
}
