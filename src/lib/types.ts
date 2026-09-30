export type Json = string | number | boolean | null | Json[] | { [key: string]: Json | undefined };

export type Appearance = "dark" | "light" | "system";
export type FocusDefault = "open" | "25" | "50" | "90" | "custom";

export type TodayCommitment = { id: string; text: string; done: boolean };

export type ProfileSettings = {
  appearance?: Appearance;
  focusDefault?: FocusDefault;
  customMinutes?: number;
  sounds?: boolean;
  notifications?: boolean;
  today3?: { date: string; items: TodayCommitment[] };
};

export type Profile = { id: string; display_name: string; settings: ProfileSettings | null; created_at?: string };
export type Goal = { id: string; session_id: string; user_id: string; text: string; completed: boolean; position: number };
export type FocusInterval = { id: string; session_id: string; user_id: string; kind: "focus" | "break"; started_at: string; ended_at: string | null };
export type FocusSession = {
  id: string; user_id: string; room_id: string | null; title: string; mode: "open" | "timed";
  duration: number | null; status: "focusing" | "break" | "finished"; started_at: string;
  finished_at: string | null; rating: number | null; intervals: FocusInterval[]; goals: Goal[];
};
export type Partner = { id: string; name: string; partnership_id: string };
export type RoomMemberSession = { id: string; title: string; status: "focusing" | "break" | "finished"; started_at: string; finished_at: string | null; interval_started_at: string | null; goals: Array<{ text: string; completed: boolean }> };
export type RoomMember = { room_id: string; user_id: string; title: string; goals: string[]; ready: boolean; name: string; session: RoomMemberSession | null };
export type FocusRoom = { id: string; partnership_id: string; created_by: string; status: "waiting" | "active" | "finished" | "cancelled"; duration: number | null; started_at: string | null; created_at: string; members: RoomMember[] };
export type ScheduledSession = { id: string; partnership_id: string; created_by: string; title: string; scheduled_for: string; duration: number | null; weekly: boolean; timezone: string; status: "scheduled" | "cancelled"; rsvps: string[] };
export type LabState = { server_now: string; profile: Profile; partner: Partner | null; sessions: FocusSession[]; room: FocusRoom | null; schedules: ScheduledSession[] };
export type Notice = { id: string; title: string; message?: string; actionLabel?: string; actionHref?: string; tone?: "default" | "success" | "warning" };
