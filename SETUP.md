# Getting the Hub Running — Setup Guide

This covers everything needed to go from the zip file to a working app you can actually click through: Foundation (auth, roles, groups) + Phase 2 (News/Events/Hub/Bible shell). Phase 3 onward isn't built yet.

---

## 1. Prerequisites

- **Node.js** installed (v18 or newer). Check with `node -v` in a terminal.
- **A Supabase account** — you already have one, since Young Adults and Choir both run on it.
- **A Vercel account** — same, you already have one with two projects deployed.
- The unzipped `nhag-hub` project folder from this conversation.

---

## 2. Pause Choir, then create a new Supabase project for the Hub

Supabase's free tier caps you at 2 active projects total. Since you're already using both slots (Young Adults + Choir), a third free project isn't available without freeing one up first.

**Pause the Choir project** (not Young Adults — that one stays live permanently as the safety net):
1. In Supabase, open the Choir project → **Project Settings** → **General** → find the pause option (or it may auto-pause; check current Supabase docs if you don't see a manual pause button).
2. Note: this takes the live Choir app (nhag-choir.vercel.app) offline for choir members until Phase 4 (Choir migration into the Hub) is done.

**Then create the new Hub project:**
1. Go to supabase.com → New Project.
2. Name it **"nhag-hub"** so it's clearly distinct from Young Adults in your dashboard.
3. Set a database password (save it somewhere), pick a region close to you.
4. Wait ~2 minutes for it to spin up.

Once Phase 4 is done and choir members are using the Hub instead, you can delete the old paused Choir project entirely rather than ever unpausing it.

---

## 3. Load the database schema

1. In your new Supabase project, go to **SQL Editor** (left sidebar) → New query.
2. Open `supabase/schema.sql` from the project folder, copy the whole file, paste it in, click **Run**.
3. New query again → open `supabase/migration_001_global_content.sql`, copy, paste, **Run**.
4. New query again → open `supabase/migration_002_group_content.sql`, copy, paste, **Run**.
5. New query again → open `supabase/migration_003_choir_tools.sql`, copy, paste, **Run**.
6. New query again → open `supabase/migration_004_bible_personal_data.sql`, copy, paste, **Run**.
7. New query again → open `supabase/migration_005_event_rsvps.sql`, copy, paste, **Run**.
8. New query again → open `supabase/migration_006_reading_plan_journal.sql`, copy, paste, **Run**.
9. New query again → open `supabase/migration_007_push_notifications.sql`, copy, paste, **Run**.
10. New query again → open `supabase/migration_008_pin_login.sql`, copy, paste, **Run**.
11. New query again → open `supabase/migration_009_group_icons.sql`, copy, paste, **Run**.
12. New query again → open `supabase/migration_010_news_categories.sql`, copy, paste, **Run**.
13. New query again → open `supabase/migration_011_sermons.sql`, copy, paste, **Run**.
14. New query again → open `supabase/migration_012_recurring_and_volunteer_events.sql`, copy, paste, **Run**.
15. New query again → open `supabase/migration_013_prayer_supporters.sql`, copy, paste, **Run**.
16. New query again → open `supabase/migration_014_multiple_reading_plans.sql`, copy, paste, **Run**. *(Note: this is schema-only prep for a "multiple reading plans" feature that's paused mid-build — safe to run now, but won't change anything visible in the app yet.)*
17. New query again → open `supabase/migration_015_admin_activity_log.sql`, copy, paste, **Run**.
18. New query again → open `supabase/migration_016_reading_plan_lock.sql`, copy, paste, **Run**.
19. New query again → open `supabase/migration_017_sermon_speaker.sql`, copy, paste, **Run**.
20. New query again → open `supabase/migration_018_group_description.sql`, copy, paste, **Run**.
21. New query again → open `supabase/migration_019_pinned_news.sql`, copy, paste, **Run**.
22. New query again → open `supabase/migration_020_notifications.sql`, copy, paste, **Run**.
23. New query again → open `supabase/migration_021_optional_event_replies.sql`, copy, paste, **Run**.
24. New query again → open `supabase/migration_022_optional_rsvp.sql`, copy, paste, **Run**.

That's every table the app needs.

---

## 4. Get your Supabase keys

1. In Supabase, go to **Project Settings** (gear icon) → **API**.
2. Copy the **Project URL** — this is `SUPABASE_URL`.
3. Copy the **service_role** key (NOT the "anon" key — service_role, under "Project API keys") — this is `SUPABASE_SERVICE_ROLE_KEY`.

⚠️ The service_role key bypasses all security rules. Never put it in client-side code or share it publicly. It only ever lives in server environment variables, which is how this project already uses it.

---

## 5. Set up environment variables locally

1. In the project folder, copy `.env.example` to a new file named `.env.local`.
2. Fill it in:
   ```
   SUPABASE_URL=https://your-project-ref.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
   APP_URL=http://localhost:3000
   EMAIL_PROVIDER=resend
   RESEND_API_KEY=re_your_actual_key_here
   ```
   Since you already have a Resend account and key, use `EMAIL_PROVIDER=resend` and paste your key as `RESEND_API_KEY`. This file (`.env.local`) is already excluded by `.gitignore`, so it never gets committed if you push this to GitHub.

   ⚠️ Important Resend limitation until you verify a sending domain: Resend will only actually deliver mail to the email address your Resend account itself is registered under — everyone else's magic link send will silently fail. Fine for testing as yourself; before real members use this, verify a domain in Resend's dashboard (Domains → Add Domain) and set `EMAIL_FROM` to an address on it (e.g. `North Hodge Assembly of God <noreply@mail.nhag.org>`).

   If you'd rather not deal with email yet, `EMAIL_PROVIDER=none` still works — magic links print to your terminal instead of sending.

3. **Push notifications need their own keys.** Run:
   ```
   npm install
   npm run generate-vapid
   ```
   This prints a `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `NEXT_PUBLIC_VAPID_PUBLIC_KEY` — add all three to `.env.local`. These are specific to this app; don't reuse the Young Adults app's keys.

4. **The daily reading reminder cron needs a shared secret**, so nobody but Vercel's own scheduler can trigger it. Add any random string as `CRON_SECRET` in `.env.local` — e.g. run `openssl rand -hex 16` in a terminal and use that.

Your `.env.local` should now have all of these filled in:
```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
APP_URL=http://localhost:3000
EMAIL_PROVIDER=resend
RESEND_API_KEY=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
CRON_SECRET=
```

---

## 6. Install and run

In the project folder, in a terminal:

```
npm install
npm run dev
```

Then open **http://localhost:3000** in a browser.

---

## 7. Make yourself the first Church Admin

There's no automatic "first user is admin" flow — this was an intentional decision so nobody can accidentally self-promote. Instead:

1. On the running app, sign in with your own email (you'll see the magic link printed in the terminal since no email provider is set up yet — copy that link and paste it into your browser).
2. Complete the username/display name setup.
3. Go back to Supabase → **Table Editor** → `users` table.
4. Find your row, click into the `is_church_admin` cell, change it to `true`, save.
5. Refresh the app — you should now see the "Church Admin" badge and the "Create a ministry" form on the Hub tab.

---

## 8. Try it out

At this point you can:
- Create a ministry from the Hub tab with any name you want — "Choir," "Wednesday Night," "Security Team," "Young Adults," anything. There's no fixed list of ministry types anymore, just a free-text label and a set of optional modules you can turn on
- Turn on **Song library + Setlists** for a Choir-style group, or **Reading Plan + Journal** for a Young Adults-style group — both, neither, or either, per group
- Assign yourself or someone else as a leader by adding them to the group via the Roster tab (once you've launched into that group)
- Post church-wide News and Events from those tabs (admin-only), and RSVP yes/no/maybe to any event — church-wide or inside a group
- Post News/Events/Prayer inside a group, reply to News/Events discussions, submit anonymous prayer requests
- Request to promote a group News post to the church-wide feed (as a leader), then approve/reject it (as admin, from the News tab)
- If a group has the Songs/Setlists module: add songs to its library, create setlists, add/reorder/remove songs within a setlist
- If a group has the Reading Plan/Journal module: track daily prayer/reading/reflection, browse the plan by week, keep a private journal — this data belongs to the person, not the group, so it survives even if the group is ever deleted. Tapping a reading reference jumps into the Bible tab at that exact passage, with a "← Back to [Group]" button that returns you to right where you were
- Use the full Bible tab — read any book/chapter, tap-select verses to highlight/note/tag them, look up commentary, cross-references, Strong's lexicon entries, dictionary/glossary terms, search the concordance, browse your own notes
- Open Settings (gear icon, top right) to set light/dark/system theme, adjust text size, toggle a wide desktop layout, turn on push notifications for this device, and choose what you get notified about — church-wide, or per-ministry
- Tap Help / FAQ from Settings for a walkthrough of how everything works
- If notifications are on: get pushed church-wide News/Events, a ministry's own News/Events/Prayer, new Choir setlists, and (for reading-plan ministries) a daily 9am reminder
- Sign in as a second person (a different email, or an incognito browser window) to test the Member experience

---

## 9. What's NOT functional yet (by design)

- **Sermons** — not built yet (you said to leave this alone for now)
- **"Add someone" in Roster looks up by exact username** — there's no search/browse-all-users list yet, just an exact-match lookup
- **Song/setlist reordering uses simple up/down buttons**, not drag-and-drop
- **Reading Plan doesn't show upcoming events on its home screen** the way the old Young Adults app did — that part of the old cross-navigation was left out (the Bible link-back IS built now), since it would need the Reading Plan to reach outside its group into church-wide Events. Worth a decision from you if it matters later
- **Notification click doesn't deep-link to the specific group or post** — tapping a notification opens the app to wherever you left it, not straight to the new item. The app's navigation isn't URL-based yet, which is what real deep-linking would need
- **Daily reminder time drifts by an hour with Daylight Saving** — see the deploy section above for why and the tradeoff

---

## 10. When you're ready to deploy (not required to just try it out)

Vercel's free tier doesn't cap project count the way Supabase does, so no pausing needed here — just add a new project alongside your existing two.

- Push the project to a new GitHub repo (separate from Young Adults and Choir's repos)
- Import it into Vercel (vercel.com → New Project → import the repo) — name it "nhag-hub"
- In that new Vercel project's settings → Environment Variables, add every variable from `.env.local` (with `APP_URL` set to your actual Vercel domain once you have it)
- Deploy

**About the daily reading reminder (9am):** `vercel.json` already schedules it — Vercel's free Hobby plan supports one-per-day cron jobs, so this works without upgrading. One caveat worth knowing: the schedule is set in UTC (`0 14 * * *`, meaning 14:00 UTC), which lines up with 9am Central during Daylight Time (roughly March–November) but drifts to 8am Central during Standard Time (winter). Vercel Cron doesn't support named time zones directly. If that hour of drift matters to you, you can adjust the schedule in `vercel.json` seasonally, or look into a small workaround (e.g. two cron entries, one only useful half the year) — not worth over-engineering for a once-a-day reminder, but flagging it so it's not a surprise.

You don't need to do any of this yet — running it locally with `npm run dev` is enough to click through everything above.

---

## If something doesn't work

The most common issues:
- **"Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"** → `.env.local` isn't filled in correctly, or you're missing the file entirely (it must be named exactly `.env.local`, not `.env.example`).
- **Magic link says "expired or already used"** → links are one-time use and expire after 15 minutes; just request a new one.
- **Can't see admin features after setting `is_church_admin = true`** → refresh the page; the app checks this on load, not live.

Bring any errors back to me (a screenshot of the error is fine) and I'll help debug from there.
