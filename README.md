# ✨ Sticky Commits — the Informatics sticker wall

A cute, 3D sticker wall where **every sticker is a pull request**.
Each student builds their own sticker by hand — a `card.json` with their picture, shape, colours, font and
holographic finish — and adds it through a real GitHub workflow: fork → branch → commit → pull request.
Once it's reviewed and merged, it slaps onto a giant zoomable cutting mat that everyone can explore.
Classmates can tilt, flip and ❤️ each other's stickers. Likes are anonymous: only the count is ever shown.

🏆 **It's a contest:** for one month, the sticker with the most likes wins **a one-month Claude subscription**.

**👉 Students: start with [CONTRIBUTING.md](CONTRIBUTING.md).**

---

## ✨ What's inside

| | |
|---|---|
| 🃏 **3D stickers** | Tilt toward your mouse, holographic & glitter foils that catch the light, a peeling corner, and a click-to-flip back side with bio + fun facts. |
| ✂️ **6 shapes** | classic · polaroid · badge (name curves around the ring!) · ticket · morphing blob · die-cut cutout |
| 🎨 **Total freedom** | 4 finishes, 9 patterns, any colours or gradients, 33 preset fonts (incl. Arabic) + any Google Font, and custom CSS sandboxed per sticker with shadow DOM. |
| 🔭 **Explorable wall** | `wall.html` is one big infinite cutting mat you drag, zoom and pinch around — with live rulers, a clickable minimap, and a camera that flies to stickers. |
| 🏆 **The contest** | A golden prize ticket, a live countdown, the current leader, a top-3 podium, and a confetti winner reveal when the month ends. Voting opens and closes on time — enforced by the database. |
| 💖 **Anonymous likes** | Heart bursts and live counts. Nobody can see who liked what. |
| 💬 **Moderated comments** | Anyone can comment on a sticker (and optionally sign their name). Comments stay hidden until you approve them on `moderate.html`. |
| ✍️ **Made by hand** | Students write their own `card.json`. VS Code autocompletes every option and flags mistakes thanks to `card.schema.json`. |
| 🤖 **PR bot** | A GitHub Action checks every pull request with beginner-friendly messages ("trailing comma on line 8", "did you mean *finish*?", "you can only edit your own folder"). |
| 🚀 **Auto deploy** | Merged stickers go live on GitHub Pages within a minute. |
| 🌙 **Polish** | Light/dark mode, search, "Surprise me", share links, mobile-friendly, keyboard accessible, respects reduced motion. |

<details>
<summary>🤫 Easter egg (spoiler)</summary>

Type `git push` anywhere on the wall (not in a text box). 🎉

</details>

---

## 🧑‍🏫 Setup for the class admin (≈10 minutes, once)

### 1. Put it on GitHub

Create an empty **public** repository on GitHub (no README), then in this folder:

```bash
git init
git add .
git commit -m "Sticker wall 🎉"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

### 2. Turn on GitHub Pages

Repo → **Settings → Pages → Build and deployment → Source: _GitHub Actions_**.
The **🚀 Deploy the wall** workflow then publishes the site at `https://<you>.github.io/<repo>/`
on every push to `main` (re-run it from the **Actions** tab the first time if needed).

### 3. Personalise `config.js`

```js
title: 'Sticky Commits',
titleGradient: ['#5b4bff', '#a04dff', '#ff5fa2'],   // the title's colours, left → right
className: 'Informatics students',
repo: '<you>/<repo>',   // used for the GitHub links on the page
contest: {
  enabled: true,
  start: '2026-11-12T00:00:00+03:00',   // likes count from here…
  end:   '2026-12-12T23:59:59+03:00',   // …until here (+03:00 = your time zone)
  prize: '1 month of Claude',
  prizeDetail: 'A one-month Claude subscription for the maker of the most-loved sticker.',
},
```

### 4. Turn on shared likes & comments

Out of the box, likes and comments are saved only in each visitor's own browser ("preview mode" —
handy for testing). To share them with everyone, use a free [Supabase](https://supabase.com) project:

1. Create a project (any name, free tier).
2. Open **SQL Editor → New query**, paste [`supabase/setup.sql`](supabase/setup.sql), and click **Run**.
3. Go to **Project Settings → API** and copy the **Project URL** and the **anon / publishable key**.
4. Paste them into `config.js` → `supabase: { url, anonKey }`, commit and push.

The anon key is *meant* to be public. The database only lets the website count/toggle likes,
send new comments (always *pending*), and read *approved* comments. It never exposes who liked
what, and pending comments can only be read by moderators. Each browser gets a random id, so
there's no login and no personal data for visitors.

> Free Supabase projects pause after a week without visits. If likes stop loading, open the
> Supabase dashboard and press **Restore** — the wall keeps working meanwhile.

### 5. Make yourself the moderator 🛡️

Comments only appear after a moderator approves them. To become one (once):

1. In Supabase, go to **Authentication → Users → Add user → Create new user**. Enter your email and
   a password, and tick **Auto Confirm User**.
2. Open **SQL Editor → New query**, run this (with your email):
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'you@example.com'
   on conflict do nothing;
   ```
3. Lock the door: **Authentication → Sign In / Providers → Email** → turn off
   **Allow new users to sign up**. (Even without this, nobody else can moderate — only accounts in
   `public.admins` can — but there's no reason to let strangers create accounts.)

**Approving comments:** open `https://<you>.github.io/<repo>/moderate.html` (it isn't linked from
the site on purpose — bookmark it) and sign in. You'll see every waiting comment with the
sticker it's on, the text and who signed it, and buttons to **✅ Approve**, **🚫 Reject** or **🗑 Delete**.
Approved comments appear on the wall instantly. The browser tab shows how many are waiting, e.g.
`(3) Moderation`. Rejected comments are never shown to anyone else (the writer just keeps seeing
theirs as "waiting"). Want a co-moderator? Repeat steps 1–2 with their email.

**Arranging the wall:** on the moderation page, click **🧩 Arrange the wall** (or open
`wall.html?arrange`, which asks you to sign in). While you're signed in, the wall shows an
**✏️ Arrange** button that only moderators ever see. In Arrange mode:
- drag any sticker to move it — it snaps to the mat's grid (hold <kbd>Alt</kbd> to place it freely);
- dragging empty space still moves the view, and a plain click still flips a sticker;
- every move saves straight away and everyone sees your layout. The first move freezes the whole
  current layout, so nothing else shuffles; stickers added later fill the free spots;
- **↺ Auto layout** puts everything back to the automatic arrangement.

The database only accepts layout changes from accounts in `public.admins`. Tick **"Keep me signed
in on this device"** when you sign in if you don't want to log in again every time (only on your
own computer).

### 6. Set the contest dates 🏆

The countdown, the leader and the winner reveal on the home page all come from `contest` in
`config.js`. To make the deadline **impossible to cheat**, also give the database the same dates —
after this, it refuses any like (or unlike) outside the window:

```sql
update public.contest
set starts_at = '2026-11-12 00:00:00+03', ends_at = '2026-12-12 23:59:59+03';
```

**Rules shown on the site:** most likes wins; one like per person per sticker; in a tie, the sticker
that reached its total first wins; demo stickers don't count. When the month is over, the home page
automatically shows the winner (with confetti 🎉), and you can double-check the final standings in
Supabase with `select * from public.like_counts() order by total desc, last_at asc;`

Want to see how the page looks before the start or after the end? Open
`index.html?contest-preview=before` or `index.html?contest-preview=ended` — it only changes what
*you* see.

> ⚠️ **About fairness:** likes are anonymous (no login), so someone determined could clear their
> browser data and like again. The database slows scripts down, but with a real prize you may want
> voters to sign in with GitHub first — still anonymous to everyone else. Ask if you'd like this.

### 7. Protect `main` (recommended)

**Settings → Branches → Add branch ruleset** for `main`:
- ✅ Require a pull request before merging
- ✅ Require status checks to pass → add **check** (from *🧩 Check sticker*)

Now nobody can break the wall, and students learn the review flow.

### 8. Demo stickers

The 8 stickers in `demo-cards/` show what's possible. With `showDemoCards: 'auto'` they disappear
automatically once 5 real stickers exist. Set it to `false` to hide them right away, or delete the folder.
Demo stickers never count in the contest.

---

## 💻 Run it locally

Needs [Node.js](https://nodejs.org) 18+ (no `npm install` — there are zero dependencies).

```bash
npm run dev      # → http://localhost:5173 (cards.json rebuilds on every refresh)
npm run check    # validate every sticker, like the PR bot does
npm run build    # build the full site into _site/
npm run schema   # regenerate card.schema.json after changing assets/js/schema.js
```

---

## 🗂️ How it fits together

```
cards/<username>/card.json   ← one folder per student (+ picture, + optional style.css)
cards/_template/             ← copy-me starter (ignored by the build)
demo-cards/                  ← example stickers
card.schema.json             ← editor autocomplete + validation for card.json
index.html                   ← home: hero, 🏆 prize + countdown, the race podium, how to join
wall.html                    ← the full-screen sticker board (likes + comments live here)
moderate.html                ← moderators approve / reject comments here
config.js                    ← site settings (title, audience, repo, contest, Supabase)
assets/js/sticker.js         ← <sticker-card> web component (3D, flip, shapes, finishes)
assets/js/schema.js          ← the sticker rules, shared by the website AND the PR bot
assets/js/camera.js          ← pan / zoom / pinch camera, rulers and minimap
assets/js/contest.js         ← contest phases, countdown maths and the ranking rules
assets/js/data.js            ← loads cards.json + keeps the like tally
assets/js/supabase.js        ← tiny Supabase client (no dependencies)
assets/js/likes.js           ← anonymous likes (Supabase or local preview)
assets/js/comments.js        ← moderated comments + the moderator API
assets/js/admin.js           ← moderator sign-in (shared by moderation + Arrange mode)
assets/js/positions.js       ← where moderators placed each sticker
assets/js/home.js            ← the home page
assets/js/wall.js            ← the wall: layout, search, likes, comments panel, easter egg
assets/js/moderate.js        ← the moderation page
scripts/build.mjs            ← validates cards → cards.json; --check for PRs; --out for Pages
scripts/serve.mjs            ← tiny dev server
supabase/setup.sql           ← likes, comments, contest window + wall layout (safe to re-run)
.github/workflows/           ← deploy + PR checks
```

`scripts/build.mjs` scans every `cards/*/card.json`, validates it with the rules in `schema.js`,
inlines custom CSS, works out when each sticker was added from git history, and writes one
`cards.json` that the website loads. Broken stickers are skipped (with a warning) instead of
breaking the whole wall.

## 💡 Ideas for future pull requests

Great follow-up exercises for the class: a new sticker shape or finish, sound effects on like,
a "sticker of the week" banner, a timeline of when stickers were added, or translating the site
into another language.
