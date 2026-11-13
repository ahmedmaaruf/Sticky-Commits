-- ════════════════════════════════════════════════════════════════
--  Sticky Commits · access codes + likes + moderated comments
--  Run this in Supabase → SQL Editor → "New query" → Run.
--  It's safe to run again (e.g. after pulling an update).
--
--  Access codes (no accounts, no names):
--   • Every student gets a printed 6-digit code (public.access_codes).
--   • The code opens the website on any device, and it's remembered there.
--   • Each code can like each sticker once. Liking and commenting need a code.
--   • Wrong guesses are limited per network (internet connection), so nobody
--     can try codes until one works. The network is only kept as a salted
--     hash — never the IP address itself.
--
--  Likes stay private:
--   • The likes table is locked — the website can't read it directly.
--   • The website only gets COUNTS, plus "which stickers did MY code like"
--     (and only if you know that code). Nobody can list who liked what.
--   • Likes only work on stickers that are really on the wall (the
--     "Sync sticker list" GitHub Action keeps that list up to date).
--
--  Comments are moderated:
--   • Every new comment is saved as 'pending'.
--   • The website can only ever read 'approved' comments.
--   • Only accounts listed in public.admins can see pending comments
--     and approve / reject / delete them (via moderate.html), or you
--     approve them in the SQL Editor (see the queries at the bottom).
-- ════════════════════════════════════════════════════════════════

-- ── Secrets (generated once, never readable from the website) ──
create table if not exists public.secrets (
  id       boolean primary key default true check (id), -- exactly one row
  sync_key text    not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  net_salt text    not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
);
insert into public.secrets (id) values (true) on conflict do nothing;
alter table public.secrets enable row level security;
revoke all on public.secrets from anon, authenticated;

-- ── Stickers that exist on the wall ────────────────────────────
-- Filled by the GitHub Action (.github/workflows/sync-stickers.yml)
-- every time something is merged into main.
create table if not exists public.stickers (
  card_id    text        primary key check (card_id ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
  updated_at timestamptz not null default now()
);
alter table public.stickers enable row level security;
revoke all on public.stickers from anon, authenticated;

create or replace function public.sync_stickers(p_key text, p_ids text[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer;
begin
  if p_key is null or not exists (select 1 from public.secrets as s where s.sync_key = p_key) then
    raise exception 'wrong sync key';
  end if;
  if p_ids is null or cardinality(p_ids) > 5000 then
    raise exception 'the sticker list is missing or too long';
  end if;
  insert into public.stickers (card_id)
  select distinct i.id from unnest(p_ids) as i(id) where i.id ~ '^[a-z0-9][a-z0-9-]{0,63}$'
  on conflict (card_id) do update set updated_at = now();
  delete from public.stickers as s where not (s.card_id = any (p_ids));
  select count(*) into v_total from public.stickers;
  return v_total;
end;
$$;

-- true when this sticker may be liked / commented on. Before the first sync
-- the list is empty, and then every well-formed id is allowed (nothing breaks).
create or replace function public.sticker_exists(p_card text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (select 1 from public.stickers)
      or exists (select 1 from public.stickers as s where s.card_id = p_card);
$$;

-- ── Which network a request came from (salted hash, never the IP) ──
-- IPv6 is grouped by /64, because one home connection gets a whole /64.
create or replace function public.client_net()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_headers json;
  v_raw     text;
  v_ip      inet;
begin
  begin
    v_headers := nullif(current_setting('request.headers', true), '')::json;
  exception when others then
    return null;
  end;
  v_raw := coalesce(
    nullif(btrim(v_headers ->> 'cf-connecting-ip'), ''),
    nullif(btrim(v_headers ->> 'x-real-ip'), ''),
    nullif(btrim(split_part(v_headers ->> 'x-forwarded-for', ',', 1)), '')
  );
  if v_raw is null then
    return null;
  end if;
  begin
    v_ip := v_raw::inet;
  exception when others then
    return null;
  end;
  if family(v_ip) = 6 then
    v_raw := network(set_masklen(v_ip, 64))::text;
  else
    v_raw := host(v_ip);
  end if;
  return left(encode(sha256(convert_to((select s.net_salt from public.secrets as s) || v_raw, 'UTF8')), 'hex'), 32);
end;
$$;

-- For checking the setup only: the first characters of YOUR network's hash.
-- (Two requests from the same connection must show the same value.)
create or replace function public.my_network()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select left(public.client_net(), 8);
$$;

-- ════════════════════════════════════════════════════════════════
--  ACCESS CODES
-- ════════════════════════════════════════════════════════════════

create table if not exists public.access_codes (
  code          text        primary key check (code ~ '^[0-9]{6}$'),
  created_at    timestamptz not null default now(),
  first_used_at timestamptz,
  last_used_at  timestamptz
);
alter table public.access_codes enable row level security;
revoke all on public.access_codes from anon, authenticated;

-- Wrong codes, per network (to stop guessing). Old rows are cleaned up automatically.
create table if not exists public.code_failures (
  net text        not null,
  at  timestamptz not null default now()
);
create index if not exists code_failures_net_at on public.code_failures (net, at);
alter table public.code_failures enable row level security;
revoke all on public.code_failures from anon, authenticated;

-- Is this a real code? Never raises for a wrong code (so the failed attempt
-- is saved); raises only when a network has guessed wrong too often.
create or replace function public.code_ok(p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_net text := coalesce(public.client_net(), 'unknown');
begin
  -- one check at a time per network, so parallel guessing can't slip past the limit
  perform pg_advisory_xact_lock(hashtext('code:' || v_net));
  if (select count(*) from public.code_failures as f
      where f.net = v_net and f.at > now() - interval '10 minutes') >= 60 then
    raise exception 'too many wrong codes from your network — wait a few minutes and try again';
  end if;
  if p_code ~ '^[0-9]{6}$' and exists (select 1 from public.access_codes as c where c.code = p_code) then
    update public.access_codes as c
    set first_used_at = coalesce(c.first_used_at, now()), last_used_at = now()
    where c.code = p_code;
    return true;
  end if;
  insert into public.code_failures (net) values (v_net);
  delete from public.code_failures as f where f.at < now() - interval '1 day';
  return false;
end;
$$;

-- 1) The code screen on the website: is this code valid?
create or replace function public.check_code(p_code text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.code_ok(p_code);
$$;

-- Make extra codes later (SQL Editor only):  select * from public.make_codes(10);
create or replace function public.make_codes(p_count integer)
returns setof text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_made integer := 0;
begin
  if p_count is null or p_count < 1 or p_count > 1000 then
    raise exception 'make between 1 and 1000 codes';
  end if;
  while v_made < p_count loop
    v_code := (100000 + (('x' || substr(md5(gen_random_uuid()::text), 1, 12))::bit(48)::bigint % 900000))::text;
    continue when v_code ~ '^(\d)\1{5}$' or v_code in ('123456', '234567', '345678', '456789', '987654', '876543', '765432', '654321');
    insert into public.access_codes (code) values (v_code) on conflict do nothing;
    if found then
      v_made := v_made + 1;
      return next v_code;
    end if;
  end loop;
end;
$$;

-- ════════════════════════════════════════════════════════════════
--  LIKES
-- ════════════════════════════════════════════════════════════════

-- Upgrading from the old version (anonymous browser ids): those likes can't
-- be tied to a code, so they're cleared.
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'likes' and column_name = 'voter_id') then
    drop table public.likes;
  end if;
end;
$$;

create table if not exists public.likes (
  card_id    text        not null check (card_id ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
  code       text        not null references public.access_codes (code) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (card_id, code)
);
create index if not exists likes_code_time on public.likes (code, created_at);

-- Lock the table: no direct reads or writes from the website.
alter table public.likes enable row level security;
revoke all on public.likes from anon, authenticated;

-- 🏆 The contest window. Likes can only change between starts_at and ends_at,
-- so nobody can sneak in votes (or remove them) after the deadline.
-- Set your dates with the query at the bottom of this file.
create table if not exists public.contest (
  id        boolean primary key default true check (id), -- exactly one row
  starts_at timestamptz,
  ends_at   timestamptz
);
alter table public.contest drop column if exists network_cap; -- not needed now that likes use codes
insert into public.contest (id) values (true) on conflict do nothing;
alter table public.contest enable row level security;
revoke all on public.contest from anon, authenticated;

-- 2) Counts only — never who. last_at breaks ties: whoever reached their total first wins.
drop function if exists public.like_counts();
create function public.like_counts()
returns table (card_id text, total bigint, last_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select l.card_id, count(*)::bigint as total, max(l.created_at) as last_at
  from public.likes as l
  where public.sticker_exists(l.card_id)
  group by l.card_id;
$$;

-- 3) Like / unlike a sticker with a code.
--    Returns {"ok":true,"liked":…,"total":…} or {"ok":false,"error":"code"} for a wrong code.
drop function if exists public.toggle_like(text, uuid); -- the old anonymous version
create or replace function public.toggle_like(p_card text, p_code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_liked boolean;
  v_total bigint;
begin
  if not public.code_ok(p_code) then
    return json_build_object('ok', false, 'error', 'code');
  end if;
  if p_card is null or p_card !~ '^[a-z0-9][a-z0-9-]{0,63}$' or not public.sticker_exists(p_card) then
    raise exception 'that sticker isn''t on the wall';
  end if;
  if exists (select 1 from public.contest as k where k.starts_at is not null and now() < k.starts_at) then
    raise exception 'voting has not opened yet';
  end if;
  if exists (select 1 from public.contest as k where k.ends_at is not null and now() > k.ends_at) then
    raise exception 'voting has closed';
  end if;

  delete from public.likes as l where l.card_id = p_card and l.code = p_code;
  if found then
    v_liked := false; -- un-liking is always allowed
  else
    -- gentle brake per code: max 40 likes per 10 minutes
    if (select count(*) from public.likes as l
        where l.code = p_code and l.created_at > now() - interval '10 minutes') >= 40 then
      raise exception 'too many likes at once — slow down a little';
    end if;
    insert into public.likes (card_id, code) values (p_card, p_code);
    v_liked := true;
  end if;

  select count(*) into v_total from public.likes as l where l.card_id = p_card;
  return json_build_object('ok', true, 'liked', v_liked, 'total', v_total);
end;
$$;

-- 4) The stickers THIS code has liked (so your hearts show up on every device).
drop function if exists public.my_likes();
create or replace function public.my_likes(p_code text)
returns table (card_id text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.code_ok(p_code) then
    return query select l.card_id from public.likes as l where l.code = p_code;
  end if;
end;
$$;

-- Only these functions are callable from the website.
revoke all on function public.sync_stickers(text, text[]) from public;
revoke all on function public.sticker_exists(text) from public;
revoke all on function public.client_net() from public;
revoke all on function public.my_network() from public;
revoke all on function public.code_ok(text) from public;
revoke all on function public.check_code(text) from public;
revoke all on function public.make_codes(integer) from public;
revoke all on function public.like_counts() from public;
revoke all on function public.toggle_like(text, text) from public;
revoke all on function public.my_likes(text) from public;
grant execute on function public.sync_stickers(text, text[]) to anon, authenticated;
grant execute on function public.my_network() to anon, authenticated;
grant execute on function public.check_code(text) to anon, authenticated;
grant execute on function public.like_counts() to anon, authenticated;
grant execute on function public.toggle_like(text, text) to anon, authenticated;
grant execute on function public.my_likes(text) to anon, authenticated;

-- ════════════════════════════════════════════════════════════════
--  COMMENTS
-- ════════════════════════════════════════════════════════════════

create table if not exists public.comments (
  id          bigint generated always as identity primary key,
  card_id     text        not null check (card_id ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
  body        text        not null check (char_length(body) between 1 and 280),
  author      text                 check (author is null or char_length(author) <= 40),
  code        text        references public.access_codes (code) on delete set null, -- who wrote it (for rate limiting)
  status      text        not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at  timestamptz not null default now(),
  reviewed_at timestamptz
);
-- Upgrading from the old version (random browser ids instead of codes)
alter table public.comments add column if not exists code text references public.access_codes (code) on delete set null;
alter table public.comments drop column if exists voter_id;
create index if not exists comments_card_status on public.comments (card_id, status);
create index if not exists comments_code_time on public.comments (code, created_at);

-- Who is allowed to moderate (filled in by the "make me an admin" query below).
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

alter table public.comments enable row level security;
alter table public.admins enable row level security;
revoke all on public.comments from anon, authenticated;
revoke all on public.admins from anon, authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins as a where a.user_id = auth.uid());
$$;

-- Admins (signed in on moderate.html) can read, approve/reject and delete comments.
grant select, update, delete on public.comments to authenticated;
drop policy if exists "admins read comments" on public.comments;
drop policy if exists "admins moderate comments" on public.comments;
drop policy if exists "admins delete comments" on public.comments;
create policy "admins read comments" on public.comments
  for select to authenticated using (public.is_admin());
create policy "admins moderate comments" on public.comments
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins delete comments" on public.comments
  for delete to authenticated using (public.is_admin());

-- 5) Send a comment with a code — it always starts as 'pending'.
--    Returns the new comment's id, or null when the code is wrong.
drop function if exists public.add_comment(text, text, text, uuid); -- the old anonymous version
create or replace function public.add_comment(p_card text, p_body text, p_author text, p_code text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  -- strip invisible control characters (line breaks are kept in the comment itself)
  v_body   text := btrim(regexp_replace(coalesce(p_body, ''), '[\x01-\x09\x0B-\x1F\x7F]', ' ', 'g'));
  v_author text := nullif(btrim(regexp_replace(coalesce(p_author, ''), '[[:cntrl:]]', ' ', 'g')), '');
  v_id     bigint;
begin
  if not public.code_ok(p_code) then
    return null;
  end if;
  if p_card is null or p_card !~ '^[a-z0-9][a-z0-9-]{0,63}$' or not public.sticker_exists(p_card) then
    raise exception 'that sticker isn''t on the wall';
  end if;
  if char_length(v_body) < 1 or char_length(v_body) > 280 then
    raise exception 'comments must be 1-280 characters';
  end if;
  v_author := left(v_author, 40);
  -- gentle spam brake: max 5 comments per code per 10 minutes
  if (select count(*) from public.comments as c
      where c.code = p_code and c.created_at > now() - interval '10 minutes') >= 5 then
    raise exception 'too many comments — try again in a few minutes';
  end if;
  insert into public.comments (card_id, body, author, code)
  values (p_card, v_body, v_author, p_code)
  returning id into v_id;
  return v_id;
end;
$$;

-- 6) Approved comments for one sticker (pending ones are never returned).
create or replace function public.card_comments(p_card text)
returns table (id bigint, author text, body text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.author, c.body, c.created_at
  from public.comments as c
  where c.card_id = p_card and c.status = 'approved'
  order by c.created_at
  limit 200;
$$;

-- 7) Approved comment counts for every sticker.
create or replace function public.comment_counts()
returns table (card_id text, total bigint)
language sql
stable
security definer
set search_path = public
as $$
  select c.card_id, count(*)::bigint as total
  from public.comments as c
  where c.status = 'approved'
  group by c.card_id;
$$;

revoke all on function public.is_admin() from public;
revoke all on function public.add_comment(text, text, text, text) from public;
revoke all on function public.card_comments(text) from public;
revoke all on function public.comment_counts() from public;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.add_comment(text, text, text, text) to anon, authenticated;
grant execute on function public.card_comments(text) to anon, authenticated;
grant execute on function public.comment_counts() to anon, authenticated;

-- ════════════════════════════════════════════════════════════════
--  WALL LAYOUT — where moderators have dragged stickers (Arrange mode)
--  Everyone can read it; only admins can change it.
-- ════════════════════════════════════════════════════════════════

create table if not exists public.card_positions (
  card_id    text primary key check (card_id ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
  x          real not null check (x between -100000 and 100000),
  y          real not null check (y between -100000 and 100000),
  updated_at timestamptz not null default now()
);
alter table public.card_positions enable row level security;
revoke all on public.card_positions from anon, authenticated;
grant select on public.card_positions to anon, authenticated;
grant insert, update, delete on public.card_positions to authenticated;

drop policy if exists "everyone sees the layout" on public.card_positions;
drop policy if exists "admins arrange the wall" on public.card_positions;
create policy "everyone sees the layout" on public.card_positions
  for select to anon, authenticated using (true);
create policy "admins arrange the wall" on public.card_positions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ════════════════════════════════════════════════════════════════
--  👑 MAKE YOURSELF AN ADMIN (only needed for moderate.html — run once,
--  after creating your user in Authentication → Users → "Add user").
-- ════════════════════════════════════════════════════════════════
-- insert into public.admins (user_id)
-- select id from auth.users where email = 'you@example.com'
-- on conflict do nothing;

-- ════════════════════════════════════════════════════════════════
--  🏆 CONTEST DATES — use the SAME times as `contest` in config.js.
--  Run this once (and again if the dates change).
-- ════════════════════════════════════════════════════════════════
-- update public.contest
-- set starts_at = '2026-11-13 00:00:00+03', ends_at = '2026-12-13 23:59:59+03';
--
-- Final standings (ties: whoever reached their total first wins):
-- select * from public.like_counts() order by total desc, last_at asc;

-- ── Handy admin queries (run manually when needed) ─────────────
-- How many codes:        select count(*) from public.access_codes;
-- Codes in use:          select count(*) from public.access_codes where first_used_at is not null;
-- Make 10 more codes:    select * from public.make_codes(10);
-- Remove a lost / abused code (also removes its likes):
--                        delete from public.access_codes where code = '123456';
-- Likes per code:        select code, count(*) from public.likes group by code order by 2 desc;
-- Sync key for GitHub:   select sync_key from public.secrets;
-- Stickers on the wall:  select * from public.stickers order by card_id;
-- Like leaderboard:      select * from public.like_counts() order by total desc;
-- Reset one sticker:     delete from public.likes where card_id = 'some-username';
-- Reset all likes:       truncate public.likes;
-- Pending comments:      select id, card_id, author, body from public.comments where status = 'pending';
-- Approve one comment:   update public.comments set status = 'approved', reviewed_at = now() where id = 123;
-- Approve everything:    update public.comments set status = 'approved', reviewed_at = now() where status = 'pending';
