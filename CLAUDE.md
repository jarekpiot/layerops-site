# LayerOps — Session Start Instructions

> This file is automatically loaded at the start of every Claude Code session in this repo. **Read it carefully and follow it.**

## STEP 1 — Read these files before doing anything else

**First, ground yourself in real time.** Run `node C:\krestel\layerops-brain\tools\brain.js now` — it prints the current Sydney wall-clock (weekday, date, time, TZ). The system only injects a date into context; without running this you will fabricate times ("10 hours ago", "09:21 AEST") from nothing. Do this before reasoning about any timestamp.

1. **`WORKFLOW.md`** — The 9-step methodology for every non-trivial change. You MUST follow this for any change that touches a deployed worker, the website, pricing/services config, or critical infrastructure.
2. **`C:\krestel\layerops-brain\_index.md`** — The LayerOps Brain. Master Map of Content for everything we know about customers, decisions, policies, and current operations. **Read this before any customer-related work or any non-trivial decision.**
3. **`C:\krestel\layerops-brain\operations\current-priorities.md`** — What matters RIGHT NOW. Read every session before suggesting any work.
4. **`~/.claude/projects/C--krestel-layerops-site/memory/project_state.md`** — Current state of the LayerOps platform: what's deployed, what's pending, recent decisions.
5. **`~/.claude/projects/C--krestel-layerops-site/memory/sessions_log.md`** — Brief journal of past sessions so you have context on what was done before.
6. **`CREDENTIALS.md`** — Inventory of which API keys exist and where they live. **Never print key values to chat.**
7. **`config/services.json`** — Single source of truth for pricing and tier definitions. If pricing comes up, this file is canonical.

### When working on a specific customer
**Always read `C:\krestel\layerops-brain\customers\<slug>\_index.md` before doing any work on that customer.** It's their dossier. Skip this and you'll make assumptions about pricing/services/tone that contradict what they've actually told us.

If a customer doesn't exist in the brain, ask Jarek to confirm their slug and create the folder using `C:\krestel\layerops-brain\_template\` as a starting point.

### Active customer pointer (always check first)
**At the start of every session, check `C:\krestel\layerops-brain\operations\active-customer.md`.** If it exists, the user is currently focused on that customer — read their full dossier (`customers/<slug>/_index.md` plus all sub-files) before suggesting any work.

### Mandatory question before any non-trivial code change
**If you're about to write or edit code that touches customer-facing behaviour, you MUST ask Jarek which customer it's for, UNLESS:**
- The active-customer.md pointer is set, OR
- Jarek has already named the customer in the current message, OR
- The change is obviously LayerOps-internal (the website, the workflow files, etc., not a tenant config)

Never assume. The cost of asking is 5 seconds. The cost of editing the wrong customer's bot config is hours and a customer relationship.

### After completing customer work
**Always log the work to the customer's timeline before ending the session:**
```
node C:\krestel\layerops-brain\tools\brain.js log <slug> "summary of what was done, why, and any open follow-ups"
```
Or directly edit `customers/<slug>/timeline.md`. The brain only stays useful if it's updated as work happens, not as a periodic chore.

### When making any non-trivial decision
Search `C:\krestel\layerops-brain\decisions\` for related decisions before proposing yours. Check `C:\krestel\layerops-brain\policies\` for any rule that applies. The brain is append-only — never modify or delete past decisions, write a new one that supersedes the old.

## STEP 2 — How to behave with Jarek

**Jarek is a solo founder building LayerOps. His livelihood is at stake. He has explicitly asked for:**

- **Brutal honesty.** No softening. No cheerleading. If something is wrong, say it. If an idea won't work, push back with reasons. If you're about to do something risky, flag it before doing it.
- **No assumptions.** If you don't know something, check. If you can't check, ask. Never invent facts about pricing, features, or what's deployed.
- **No glazing.** Don't open responses with "Great question!" or "You're absolutely right!". Get to the point.
- **Push back on bad ideas.** He wants you to disagree when his instinct is wrong, not just execute. The user has explicitly said: "you should be able to push back on any ideas i have - you can check me if i am doing somethign wrong".
- **Concise.** He's running a business. Don't over-explain. Three sentences over thirty when possible.

## STEP 3 — What's been built (high level — read project_state.md for details)

- **Website**: layerops.tech (Cloudflare Pages, static HTML, ~7-8 pages)
- **Workers**:
  - `layerops-chat` (api.layerops.tech) — Kestrel website chatbot
  - `layerops-audit` (audit.layerops.tech) — SEO audit tool, premium audit, CRM API, Resend webhooks
  - `layerops-clients` (*.layerops.tech) — Multi-tenant client chatbot widgets and landing pages (Byron Bay Platinum etc.)
  - `layerops-voice` (voice.layerops.tech) — Phone-based AI receptionist via Twilio ConversationRelay. **Source lives at `C:\krestel\layerops-voice` (NOT inside this repo as of 2026-04-07).**
  - `layerops-intel` (intel.layerops.tech) — Weekly market intelligence cron worker
- **Tools**: `tools/` directory has scout, outreach-sequence, market-intel, premium audit, sync-config, and more

## STEP 4 — Use the 9-step workflow for any non-trivial change

Read `WORKFLOW.md` for the full version. Quick recap:

1. Read first
2. Plan with files + line counts + risk levels
3. Five-question gate
4. Safety net (git tag, feature branch, note deployed version)
5. Build on a branch
6. Show the diff before committing
7. Test locally
8. Deploy with rollback ready
9. Update auto-memory at the end

## STEP 5 — At the end of every session

**Before the user closes the chat, you MUST:**

1. Update `~/.claude/projects/C--krestel-layerops-site/memory/project_state.md` with:
   - What was built or changed in this session
   - What's now deployed
   - What's still pending
2. Add a brief entry to `~/.claude/projects/C--krestel-layerops-site/memory/sessions_log.md`:
   - Date
   - Session summary (3-5 bullet points)
   - Decisions made
   - Open items
3. Update the LayerOps Brain at `C:\krestel\layerops-brain\`:
   - For each new customer interaction → update their `customers/<slug>/timeline.md` and `decisions.md`
   - For each new decision → create a new file in `decisions/YYYY-MM-DD-slug.md` (append-only — never modify old decisions)
   - For each new policy/rule → create a new file in `policies/`
   - Update `operations/current-priorities.md` if priorities have shifted
   - Commit the brain repo (locally, NEVER push to a public remote — it contains customer data)
4. Commit and push any code changes to git
5. Tell Jarek explicitly that you've updated memory, the brain, and pushed code

## STEP 6 — Critical things to never forget

- **Never print API key values to chat.** They get logged in session history and become a leak.
- **Never commit `.claude/settings.local.json`** — it captures shell commands which sometimes contain secrets.
- **Never deploy a worker without git history** — git init it first, commit, then deploy.
- **Pricing always comes from `config/services.json`** — never hardcode prices in worker prompts or HTML.
- **The Kestrel demo number is `(02) 5941 6608` (`+61259416608`).** This is the most important phone number in the business. It's in the email signatures, the website, and the outreach sequence.
- **Jarek's mobile is `0404 003 240` (`+61404003240`).** Used for live call forwarding when "available" toggle is on.

## STEP 7 — Known open items as of 2026-04-07

- **Resend API key still publicly visible on GitHub** in `admin/index.html`. NEEDS ROTATION.
- **Anthropic API key in `.claude/settings.local.json`** (local only, not on GitHub). Should be rotated.
- **Live call forwarding feature in progress** on `layerops-voice` — git init pending, then implementation.
- **Byron Bay Platinum and Nice Feilds Farm** are warm leads (friends) waiting for live demos. Aaron + Thomas to call back.
- **Google Business Profile** verification in progress (3-5 days from 2026-04-06).

---

**If you've read this, the next thing you should say to Jarek is something like: "I've read CLAUDE.md, WORKFLOW.md, and the memory files. Here's where we left off: [summary]. What are we working on today?"**

**Do not start any work without doing this first.**
