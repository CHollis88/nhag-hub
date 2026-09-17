-- NHAG Church Hub — Message reactions
--
-- One shared table for both Direct Message and Group Chat messages, since
-- a reaction is identical in shape either way -- message_type is a
-- discriminator rather than two near-duplicate tables. Fixed 4-emoji set
-- (👍 ❤️ 🙏 😂), enforced in application code, not a DB constraint, so
-- adding a 5th emoji later never needs a migration.

create table if not exists message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_type text not null check (message_type in ('dm', 'group_chat')),
  message_id uuid not null, -- references group_dm_messages.id OR group_chat_messages.id, per message_type
  user_id uuid not null references users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (message_type, message_id, user_id, emoji)
);

create index if not exists idx_reactions_lookup on message_reactions(message_type, message_id);

alter table message_reactions enable row level security;
