-- Run this once in the Supabase dashboard: your project → SQL Editor → New query → paste → Run.
-- I couldn't run this myself — this sandbox can reach your project's HTTPS API (that's how the
-- `note-snapshots` storage bucket below got created automatically) but not the direct Postgres
-- port, which Supabase only exposes over IPv6 or through a regional pooler this environment
-- doesn't have a DNS route to. This one paste is the only manual step left.

create table if not exists events (
  id text primary key,
  name text not null,
  prompt text not null,
  mode text not null default 'candid',
  theme_id text not null,
  station_theme_id text,
  host_note jsonb,
  is_closed boolean not null default false,
  -- Capability token, not a password: an unguessable nanoid generated at
  -- creation, kept in the creating device's localStorage, and never
  -- returned by any SELECT the app issues (see the app-layer column list
  -- in src/lib/supabase.ts) so it can't leak just by loading the Poster.
  -- Every write to this row is filtered by `.eq('host_token', ...)` at
  -- the query level — wrong or missing token means the update matches
  -- zero rows. This is a capability-URL pattern, not real auth: anyone
  -- who reads it from the client's own localStorage or the network tab
  -- on the host's OWN device can act as host. Fine for a low-stakes
  -- event feedback tool; not a substitute for real auth if that ever
  -- matters here.
  host_token text not null,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create table if not exists notes (
  id text primary key,
  event_id text not null references events(id) on delete cascade,
  strokes jsonb not null default '[]'::jsonb,
  decorations jsonb,
  canvas_width numeric not null,
  canvas_height numeric not null,
  author_name text,
  author_email text,
  -- Public URL into the note-snapshots storage bucket — a flattened PNG
  -- of the note, generated client-side at submit time. Nullable: the
  -- upload is best-effort (see renderStamp-style flatten in Station.tsx);
  -- the ink itself (strokes/decorations) is the durable record either way.
  png_url text,
  created_at timestamptz not null default now()
);

create index if not exists notes_event_id_idx on notes (event_id);

alter table events enable row level security;
alter table notes enable row level security;

-- Attendees need to read events/notes with no login at all (Poster, Wall,
-- Artifact, Station are all public-by-link) — but SELECT * would also
-- hand back host_token to anyone. The app never runs `select('*')`
-- against events; it always names columns explicitly, excluding
-- host_token. RLS itself can't hide a single column from a wildcard
-- select, only the app's own query shape does that here — documented
-- above and in src/lib/supabase.ts.
create policy "public read events" on events for select using (true);
create policy "public read notes" on notes for select using (true);

-- Anyone can create an event (no signup) and anyone can submit a note —
-- that's the whole product. Neither can be updated or deleted by anon.
create policy "public insert events" on events for insert with check (true);
create policy "public insert notes" on notes for insert with check (true);

-- Updates (Setup edits, closing the event) stay open at the RLS layer —
-- the real gate is the `.eq('host_token', token)` filter every update
-- query carries, described above.
create policy "public update events" on events for update using (true);

-- Storage: the note-snapshots bucket already exists (created via the
-- Storage REST API), public=true, 500KB/file, image/png only — that cap
-- keeps ~150 notes comfortably inside Supabase's free-tier storage
-- quota. Objects still need their own RLS on storage.objects:
create policy "public insert note snapshots"
  on storage.objects for insert
  with check (bucket_id = 'note-snapshots');

create policy "public read note snapshots"
  on storage.objects for select
  using (bucket_id = 'note-snapshots');
