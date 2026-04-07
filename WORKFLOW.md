# LayerOps Development Workflow

> Adopted 2026-04-07. Use this for every non-trivial change (any change that touches a deployed worker, the website, or critical config).

The goal is **no surprises**. Every change is reversible. Every decision is yours. Nothing gets deployed without you seeing what's about to happen.

---

## The 9-step workflow

### 1. Read first
Before suggesting any change, I read the existing code to understand the current state. No guessing about what's there. If the source isn't local (e.g. a deployed worker that wasn't checked in), I either pull it or ask you to.

### 2. Plan with files, line counts, and risk levels
For every change I'll show you a table like this **before any code is written**:

| File | Change | Risk |
|---|---|---|
| `worker.js` | Add new endpoint `/foo` (~30 lines) | LOW — additive |
| `system-prompt.js` | Modify pricing block (~10 lines) | MEDIUM — changes live behaviour |

Risk levels:
- **LOW** — additive, doesn't touch existing logic
- **MEDIUM** — touches live behaviour but easy to roll back
- **HIGH** — touches critical paths (auth, billing, deploys); needs extra care

### 3. Five-question gate
Before any code, I'll list specific decisions you need to make as numbered questions. You answer "yes/no/this value" — no assumptions.

Example:
> 1. Forward number = `+61404003240`?
> 2. Timeout = 20 seconds?
> 3. Use both checks (toggle + Cal.com) or just toggle?

### 4. Safety net before changes
Before touching code:
- **Git tag the current state**: `git tag baseline-YYYYMMDD-feature-name`
- **Create a feature branch**: `git checkout -b feature/<name>`
- **Note the deployed Cloudflare version ID** so we can `wrangler rollback` if needed
- For workers not yet in git, **git init them first**

### 5. Build on a branch
Never directly on master. Master stays deployable at all times.

### 6. Show the diff before committing
After writing code, I show you the diff (or summarise the changes) before committing. You eyeball it. If anything looks wrong, we revert or adjust.

### 7. Test locally before deploying
Use `wrangler dev` or `wrangler pages dev` for local testing. For workers that need real Twilio/Cal.com integration, test the isolated functions with curl before touching the live deploy.

### 8. Deploy with rollback ready
- First deploy is reversible in one command (`wrangler rollback <previous-version-id>`)
- Verify the new behaviour works
- Only then merge the feature branch back to master

### 9. Update auto-memory at the end
At the end of every session:
- Update `~/.claude/projects/C--krestel-layerops-site/memory/project_state.md` with what was built, what's deployed, what's still open
- Add a brief journal entry to `memory/sessions_log.md`
- Commit the WORKFLOW or memory updates if anything procedural changed

---

## When to skip this workflow

Skip the full workflow for **trivial changes**:
- Typo fixes
- CSS tweaks
- Updating a README
- Changing a static value in a JSON config (not pricing — pricing always follows the workflow because it's customer-facing)

For these, just show the diff and commit. No need for tags/branches.

---

## Rollback playbook

If something breaks after deploy:

### Rollback the deployed worker
```
npx wrangler rollback <previous-version-id> -c <wrangler.toml>
```
Cloudflare keeps the previous deployment available. This restores the running worker without changing local code.

### Rollback the local code
```
git checkout master                # or the previous tag
git branch -D feature/<broken>     # if you want to nuke the branch
```

### Rollback BOTH (full reset)
```
npx wrangler rollback <prev-id> -c <wrangler.toml>
git checkout master
git tag -d feature-tag-if-any
```

---

## Required reading before any change

If you're picking up where a previous session left off, read:
1. `~/.claude/projects/C--krestel-layerops-site/memory/project_state.md` — current state of the project
2. `~/.claude/projects/C--krestel-layerops-site/memory/sessions_log.md` — what we did last time
3. `git log --oneline -20` — recent code history
4. `CREDENTIALS.md` — what secrets exist and where

---

## Adopted

- **Date**: 2026-04-07
- **Why**: After a session where credentials were leaked into git history (Resend key in `admin/index.html`), un-tracked workers were modified live without backup, and stale pricing existed in 6+ files due to no single source of truth. This workflow prevents those mistakes from recurring.
