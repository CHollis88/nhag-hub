-- NHAG Church Hub — v65 features
--
-- One migration covering all of v65's schema needs: prayer follow-up
-- status, post reactions (reusing the message_reactions shape from
-- migration_028), member profile fields, sermon series, draft posts,
-- general feedback, and curriculum materials. Pin/Featured posts
-- already shipped in migration_019 (group_news.pinned / global_news.pinned)
-- so there's nothing to add for that one here.

-- ── Prayer Request Follow-Up ────────────────────────────────────────
-- status_updated_at is separate from created_at so "how long has this
-- been answered" is answerable without losing the original post date.
alter table group_prayer add column if not exists status text not null default 'open'
  check (status in ('open', 'answered', 'still-praying'));
alter table group_prayer add column if not exists status_updated_at timestamptz;

-- ── Reactions on Posts ──────────────────────────────────────────────
-- Mirrors message_reactions (migration_028) exactly: one shared table,
-- a type discriminator instead of separate tables per content type, and
-- the same fixed-emoji-set-in-app-code approach so a 5th emoji never
-- needs a migration. post_type covers everything reactable in v65:
-- group news, global news, and group prayer (sermons deliberately
-- excluded -- see route-level note).
create table if not exists post_reactions (
  id uuid primary key default gen_random_uuid(),
  post_type text not null check (post_type in ('group_news', 'global_news', 'group_prayer')),
  post_id uuid not null, -- references group_news.id / global_news.id / group_prayer.id, per post_type
  user_id uuid not null references users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (post_type, post_id, user_id, emoji)
);

create index if not exists idx_post_reactions_lookup on post_reactions(post_type, post_id);

alter table post_reactions enable row level security;

-- ── Member Profiles ─────────────────────────────────────────────────
-- Bio only, per Cam's decision -- location/interests were considered
-- and deliberately dropped before shipping.
alter table users add column if not exists bio text;

-- ── Sermon Series ───────────────────────────────────────────────────
-- Sermons are already church-wide only (no group_id on the sermons
-- table -- confirmed in migration_011), so series are church-wide too;
-- no separate per-group series table is needed. series_order is the
-- position within the series ("3 of 6"), not a global sort key.
create table if not exists sermon_series (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table sermons add column if not exists series_id uuid references sermon_series(id) on delete set null;
alter table sermons add column if not exists series_order integer;

create index if not exists idx_sermons_series on sermons(series_id, series_order);

alter table sermon_series enable row level security;

-- ── Draft Posts ─────────────────────────────────────────────────────
-- status mirrors the existing kind/pinned column style. A draft is
-- simply excluded from the normal GET list rather than soft-deleted --
-- same row, same id, just not visible to members until published.
alter table group_news add column if not exists status text not null default 'published'
  check (status in ('draft', 'published'));
alter table global_news add column if not exists status text not null default 'published'
  check (status in ('draft', 'published'));

-- ── General Feedback ────────────────────────────────────────────────
-- group_id nullable: feedback can be about a specific ministry or
-- about the church/app generally. is_anonymous mirrors group_prayer's
-- pattern -- created_by is still stored (so an admin abuse case is
-- still traceable at the DB level) but stripped server-side in the API
-- response, same as anonymous prayer requests.
create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) on delete cascade,
  created_by uuid references users(id) on delete set null,
  is_anonymous boolean not null default false,
  message text not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_feedback_resolved on feedback(resolved, created_at desc);

alter table feedback enable row level security;

-- ── Curriculum / Class Materials ────────────────────────────────────
-- Same shape as the existing programs/documents pattern -- one row per
-- uploaded file, PDF-only enforced in the API route (not the DB),
-- 20MB cap enforced at upload time.
create table if not exists curriculum_materials (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  title text not null,
  description text,
  file_url text not null,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_curriculum_group on curriculum_materials(group_id, created_at desc);

alter table curriculum_materials enable row level security;
