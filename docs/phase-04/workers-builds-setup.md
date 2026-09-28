# Workers Builds Setup — Owner Runbook (04-10 Task 1)

This is the exact runbook for the owner (Jaime) to follow in 04-10. This plan (04-09) does not
touch the Cloudflare dashboard, does not connect any repository, and does not deploy anything
beyond the local spike builds in `docs/phase-04/build-measurements.md`. Every value below is
spelled out explicitly — no placeholder, no "figure it out later."

No secret VALUE appears anywhere in this document — only variable NAMES and where their real
values live (Workers Builds environment variables, or the gitignored `.dev.vars`).

## 1. Create the public GitHub remote

- Create a **public** GitHub repository named **`915tldr-frontend`** (D-03 — a one-way,
  owner-decided name; matches the Phase 12 repo-split target so that later `mv` converges on an
  existing name). Empty repo, no README, no `.gitignore` template (this repo already has one).
- The owner creates the remote and pushes via **lazygit** — Claude never creates a remote,
  pushes, or creates/switches branches (per this project's own git rules).
- Add the new remote to this local checkout in lazygit, then push:
  - `main`
  - `develop`
  - `feature/phase-04`
- **Note:** `main` currently holds only the initial commit. A production build of it (once
  connected below) fails harmlessly — there is no article/changelog data pipeline wired to
  `main` yet — and deploys nothing, which is the correct, safe behavior for an as-yet-unmerged
  branch.

## 2. Connect the repository in the Cloudflare dashboard

Cloudflare dashboard → **Workers & Pages** → **`915tldr-v2`** → **Settings** → **Build**:

- **Connect repository:** `915tldr-frontend` (the remote created in step 1).
- **Production branch:** `main` (D-04 — only merged, released code auto-deploys to production;
  `feature/*`/`develop` never auto-deploy production).
- **Root directory:** `/`
- **Build command:** `pnpm run build:ci`
- **Deploy command:** `pnpm run deploy:ci`
- **Non-production branch builds:** enabled, with deploy command
  `pnpm exec wrangler versions upload --config wrangler.jsonc` — a preview/versioned deploy,
  which **never** calls `commitLastGood` (only `deploy:ci`, i.e. `tools/ci-build.mjs deploy`,
  does that — see `tools/ci-build.mjs`'s `runCi()`). Previews must never advance the last-good
  baseline that gates the next production build's never-shrink check (D-14). **The
  `--config wrangler.jsonc` flag is required, not optional** — 04-06 found that a bare
  `wrangler` invocation reads the adapter-generated `dist/client/wrangler.json` via
  `.wrangler/deploy/config.json`'s redirect, which carries no `main` field and would silently
  omit this project's Worker (see 04-06-SUMMARY.md's Deviation 1). The Cloudflare dashboard
  itself now labels this field **"Version command"** (non-production) and **"Deploy command"**
  as **"Preview command"** in some dashboard revisions — same setting, updated label; enter the
  full command with the flag regardless of which label the dashboard shows.
- **Build caching:** on. This is what makes D-06's incremental-loading design real — Workers
  Builds' build caching auto-detects Astro and caches `node_modules/.astro` (plus the pnpm
  store) between builds; without it, every build is a cold, full-corpus fetch.

## 3. Build variables

Cloudflare dashboard → the same Worker → **Settings** → **Build** → **Variables**:

| Variable | Type | Scope | Purpose |
|---|---|---|---|
| `NTFY_TOPIC` | **Secret** | All branches | `tools/ci-build.mjs`'s only way to reach the owner on a failed build (D-15). Without it, `runCi()` refuses to run at all under `WORKERS_CI` (see the T-04-38 preflight check). Use the real topic value from the `jja-ntfy` skill's configured topic — never write that value into this repo. |
| `NTFY_SERVER` | Plain (optional) | All branches | Only needed if not using the default `https://ntfy.sh`. |
| `NTFY_TOKEN` | **Secret** (optional) | All branches | Only needed if the ntfy topic requires auth. |
| `ASTRO_INCREMENTAL_BUILD` | Plain | **`feature/phase-04` (non-production) branch ONLY, during the spike** | `1` to turn on the experimental flag seam this plan adds to `astro.config.mjs`. Must NOT be set on the `main` (production) branch scope — 04-11 is where the owner's actual production decision on this flag gets made and applied; setting it on production before then would silently change production build behavior ahead of that decision. |

## 4. Confirm the injected Cloudflare credentials

Workers Builds automatically injects `CLOUDFLARE_ACCOUNT_ID` and a build-scoped
`CLOUDFLARE_API_TOKEN` into every build — **do not** add these as build variables yourself; a
manually-added value would shadow (and could silently drift from) the platform-injected one.

To confirm the injected token carries the two scopes this project's own build needs
(`d1-articles-loader`/`changelog-loader` read D1; `build-state.ts`/`kv-manifest.ts` read+write
KV):

1. Cloudflare dashboard → **My Profile** → **API Tokens** (or, if Workers Builds uses an
   account-level Workers Builds token rather than a personal one, the equivalent token shown
   under the Worker's own Build settings — check "Manage Account API Tokens" from the Build
   settings screen for the exact one Workers Builds is using).
2. Open the token's permission list and confirm it has:
   - **D1** → **Read** (or **Edit**, which implies read) on this account.
   - **Workers KV Storage** → **Edit** (needed for both reading `build:last-good`/the render
     manifest and writing new manifest entries — read-only is not sufficient).
3. If either scope is missing, edit the token (or create a new scoped token and re-point
   Workers Builds at it, if Workers Builds' injected token cannot be edited directly) to add
   the missing permission, then re-run a build to confirm the loader no longer throws a
   permission-denied error.

This mirrors the exact gap Phase 3 (03-01 Task 2) found and fixed for the owner's own local
`CLOUDFLARE_API_TOKEN` — Workers Builds' injected token is a **separate** credential and must be
checked independently; passing locally does not imply passing here.

## 5. Create the Deploy Hooks

Cloudflare dashboard → the same Worker → **Settings** → **Build** → **Deploy Hooks**:

- **`feature/phase-04`** (spike) — used only for this phase's manual incremental-build spike
  runs against Workers Builds, if the owner chooses to trigger one from the dashboard rather
  than a git push.
- **`main`** (production) — this is the hook D-02 wires into the existing ingest cron in
  `915tldr.com2`, which POSTs it after ingest finishes, only when rows changed. **Keep this
  URL** — 04-11 is where it becomes a secret in the backend Worker (`915tldr.com2`).

Both hook URLs are secrets the instant they exist (anyone who has one can trigger a build).
**Do not paste either URL into this repo, into a chat message that gets logged, or into any
committed file.** To hand the `feature/phase-04` hook URL to a Claude session for the spike:

- Store it as `DEPLOY_HOOK_URL_PHASE04` in this project's gitignored `.dev.vars` (same file
  that already holds `RENDER_MANIFEST_KV_NAMESPACE_ID` — confirm `.dev.vars` is listed in
  `.gitignore` before writing, which it already is for this repo).
- A session that needs to trigger the hook reads it from that file's environment at run time
  (`source .dev.vars` or an equivalent env-loading step) — never by asking the owner to paste
  the raw URL into the conversation, and never by echoing the value back in a log message.

## 6. Record the account's build-minute allowance and concurrency

Cloudflare dashboard → **Workers & Pages** → **Builds** (account-level, not per-Worker) shows
the current plan's monthly build-minute allowance and concurrent-build limit.

**Not yet verified against the live dashboard as of this plan (04-09) — this is a placeholder
figure for the owner to confirm in 04-10, not a researched fact:** ~360 builds/month expected
(a 2-hourly ingest cron triggering a Deploy Hook, per D-02, is 12 builds/day × 30 days = 360),
assuming each build stays comfortably under whatever per-build minute cap the plan enforces.
Record the actual allowance and concurrency shown on the account here once confirmed in 04-10,
and flag back to the owner if 360 builds/month would approach or exceed either limit.

---

**Status:** This document is the runbook only. No Cloudflare dashboard setting was changed and
no repository was connected by this plan (04-09) — that is 04-10's job, a human checkpoint.
