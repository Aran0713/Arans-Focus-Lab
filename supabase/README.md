# Focus Lab database

The production Supabase project is managed through migrations applied with the Supabase management integration.

Collaboration v3 (2026-09-30) changed the social model from one partner to up to three private pairwise partner connections and group focus rooms of up to four total participants. The production migration also added:

- `schedule_members` for per-session invitees
- group `room_members`
- authoritative multi-partner `lab_state()` / `lab_command()` logic
- editable live-session goals
- independent participant focus, break, and finished states
- schedule RSVP membership
- `video_access(room_id)` as the authenticated authorization gate for private Daily video rooms
- guards preventing simultaneous open-room membership and partnerships larger than two people
- `create_partner_invite()` for multiple single-use outstanding invite links

Direct table access remains restricted by RLS. Client writes flow through the intentionally narrow RPC surface so private history is not exposed to focus partners.

Do not expose the Daily API key or any Supabase service-role credential to the browser.
