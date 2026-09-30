# Aran’s Focus Lab

A calm, private focus and accountability app for solo work and one trusted focus partner.

**Product loop:** Show up → Focus → Take honest breaks → Finish → See actual effort → Improve.

## What is implemented

- Email/password authentication with persistent Supabase sessions
- Optional Google OAuth entry point
- Open-ended, 25, 50, 90, and custom focus modes
- Timestamp-derived Focus → Break → Resume → Finish accounting
- Session goals and completion state
- Daily, weekly, monthly and recent-session analytics derived from raw intervals
- One-partner invite links, private shared rooms, independent break/finish states
- Supabase Realtime presence and broadcast refreshes for partner state
- Scheduled accountability sessions
- Responsive mobile bottom navigation and desktop navigation
- Dark, light and system appearance modes
- Deterministic focus-accounting test

## Stack

Next.js 15, React 19, TypeScript, Tailwind CSS, Supabase (Postgres/Auth/Realtime/RLS), and Vercel.

## Environment

Copy `.env.example` to `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Then run:

```bash
npm install
npm test
npm run build
npm run dev
```

## Database

The production database is the Supabase project **Aran’s Focus Lab**. Its foundation migration creates profiles, one-partner relationships, private focus sessions, raw focus/break intervals, goals, shared rooms, scheduling, and the `lab_state` / `lab_command` RPC boundary. Important user history is private by default; shared-room state is intentionally narrower than private analytics.

## Reliability principles

Timers are never persisted once per second. The database stores authoritative timestamps and the browser derives the display. Focus and break intervals remain separate so reloads, long sessions, and multiple break cycles do not fabricate work time.
