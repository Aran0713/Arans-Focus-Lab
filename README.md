# Aran’s Focus Lab

A calm, private focus and accountability app for solo work and one focus partner. Built with Next.js, TypeScript, Tailwind and Supabase.

## Local setup
1. `npm install`
2. Copy `.env.example` to `.env.local` and add Supabase URL + publishable key.
3. Apply `supabase/migrations/001_foundation.sql` to a Supabase project.
4. `npm run dev`

## Product principles
Show up → Focus → Take honest breaks → Finish → See actual effort → Improve. Timers are timestamp-derived; focus and break intervals are separate; critical history is persistent; partner-visible state is intentionally narrower than private analytics.
