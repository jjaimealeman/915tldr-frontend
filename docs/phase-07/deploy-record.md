# Phase 7 deploy record (07-08)

Status at the time of writing: **Before merge section only. Nothing is merged, pushed or deployed.**
The deploy is Jaime's merge and push (lazygit) and the Workers Build on `main`. The "After deploy"
section is appended by 07-08 Task 3 once the push has landed.

## Before merge

### 1. Branch and live state

| Item | Value |
|---|---|
| Branch | `feature/phase-07` |
| Branch HEAD (`git rev-parse HEAD`) | `d8575405e029454dd1acb7a9889f3e08c8c432bb` |
| Commits ahead of local `main` | 31 (`git log --oneline main..HEAD`) |
| Local `main` / `develop` tips | `269129fd964e8959c895190658b07730913fc634` / `4dfe7e9183c1f1870929720a942957b0900d15dc` (they differ, so merge `develop` into `main` as planned) |
| Live `/version.json` `commit` on dev.915tldr.com | `main` (a branch name, not a sha: Deploy Hook/cron builds report the branch, STATE 05-11) |
| Live homepage stylesheet href | `/_astro/Base.h88la9Hn.css` |

### 2. "Before" snapshot (read-only GETs against dev.915tldr.com, via `tools/verify-share-meta.mjs`)

Evidence: `docs/phase-07/evidence/live-check-pre.json` (exit 1, as expected).

- **125 checks: 33 pass, 92 fail.** The failures are the "before" state. They are all of the same
  kinds: every `og:*` and `twitter:card` / `twitter:image:alt` tag reads `observed null` on the EN
  home, ES home, EN article, ES article and the noindex page (`/es/source/ktsm`); no icon `<link>`
  tags (`observed []`); and `og-image.png`, `og-image-es.png`, `favicon.ico`, `favicon.svg`,
  `apple-touch-icon.png` all return **404 text/html** (10,629 bytes, with `x-robots-tag=noindex`).
  The four crawler UA probes get a 404 for the card.
- Passing before the deploy: version.json readable, live-article discovery, "no forbidden X tags",
  "no empty meta", "no duplicate meta keys", "no article:* tags on a page", the four crawler UA
  probes for the article page (200), and robots.txt allowing the four crawlers (`/`, article and
  `/og-image.png` allowed).
- Discovered live article: `/community/gabby-garza-cooks-fajitas-as-garzas-great-great-granddaughter-e61a8c45-57e7-45f7-aa28-ea06e605a400`.

Page weight before (uncompressed HTML bytes, from the checker's "page weight (info)" line):

| Page | Bytes before |
|---|---|
| EN home | 11,945 |
| ES home | 12,168 |
| EN article | 14,015 |
| ES article | 14,249 |
| noindex page (`/es/source/ktsm`) | 28,433 |

### 3. Green gate (run today on the unchanged branch, working tree has only the untracked paths that are never staged)

| Command | Result |
|---|---|
| `pnpm run test:fast` | exit 0; 1207 tests, 1193 pass, 0 fail, 0 cancelled, 14 skipped |
| `node --test` on head-harness, share-card-assets, share-origin-guard, verify-share-meta, measure-share-fetches | exit 0; 94 tests, 94 pass, 0 fail, 0 skipped (20 + 25 + 17 + 23 + 9) |
| `pnpm run guard:config` | exit 0; "no violations found (ARCH-04, ARCH-05, T-03-01)"; "assert-share-origin ok: og:image origin https://dev.915tldr.com matches custom domain dev.915tldr.com" |
| `node tools/og-card/render.mjs --review <tmpdir>` | exit 0; "review wrote 11 files (want 11)", "aborted (non-allow-listed) requests: 0", "render ok" |

No unrelated failures. The 14 skips are the same count as at 07-07 (the dist-dependent test
`share-meta-dist` among them, because no build ran, per Jaime's 4a answer).

### 4. Jaime's 07-06 answers as applied in 07-07

All "defaults." (1a 2a 3a 4a 5a): cards as rendered, 20px credit line, `twitter:image:alt` kept,
no local full build, `favicon.svg` stays v1's tile. No code or asset changed in 07-07.

### 5. Deploy impact (what the merge does)

Re-derived from files that exist now, with arithmetic. Sources and their age are stated.

**Every page re-renders.** Not re-measured today. Basis: `src/layouts/Base.astro` is changed on
this branch (`git diff --name-status main..HEAD -- src` lists `M src/layouts/Base.astro`, plus the
two article pages and the new `src/lib/share-meta.ts`), and Base.astro is a dependency of every
page; Astro's incremental build keys reuse on the page's module dependency hash
(`node_modules/astro/dist/core/build/generate.js`, as read at plan time). No CSS file is touched on
this branch (the only changed files under `src/` are the four above), and the diff of Base.astro
adds no `<style>` line, so I expect the stylesheet href to stay `Base.h88la9Hn.css`. That is an
expectation until the post-deploy comparison in Task 3.

**Static files re-upload (all HTML).** From `dist/client/static-budget.json` (a local build of
2026-10-04, stale by 4 days): `staticFileCount` 59,616. New files on this branch in `public/`:
`og-image.png` (41,539 B), `og-image-es.png` (42,524 B), `favicon.ico` (922 B), `favicon.svg`
(290 B), `apple-touch-icon.png` (4,389 B) = 5 files. 59,616 + 5 = **59,621** by the gate's count,
if the corpus had not grown since 2026-10-04; it will have, so the real number is higher. Headroom
to the 80,000 fail line: 80,000 - 59,621 = 20,379; to the 100,000 platform limit: 40,379. No
per-file upload charge is known to this project; not verified.

**Archived R2 objects re-upload.** From `dist/archive-plan.json` `counts` (plan `generatedAt`
2026-10-04T20:43:18.727Z, **stale** relative to today's corpus; it is the same plan 06-15 used):

| Counter | Value |
|---|---|
| `archivedArticles` | 13,290 |
| `archivedTags` | 17,728 |
| English archived objects | 13,290 + 17,728 = 31,018 |
| `archivedArticlesEs` / `archivedTagsEs` | 13,290 / 17,728 = 31,018 |
| **Total archived objects** | 31,018 x 2 = **62,036** |

This equals 06-15's figure, which is expected because it is the same plan file. The corpus has
grown since, so today's real count is at least this and probably slightly more. Every archived page
gets a new head, so every one changes and is re-uploaded by `archive-sync post` over several
2-hourly builds. Convergence time is an estimate: 05-10 measured 54.64 objects/s, and 06-15
converged about 31k in 2 builds, so about 4 builds, roughly 8 hours, for 62k. Until an archived
page is re-uploaded it serves its old head (no share tags), which is why every live check uses a
non-archived page.

**R2 Class A cost (estimate, not measured).** The rate is 06-15's: 4.50 USD per million Class A
requests. 62,036 x 4.5 / 1,000,000 = **0.2792 USD, about 0.28 USD**, as an upper bound at list
price. The account's monthly free million Class A requests was not checked, so this could be 0 USD.
Below the 1 USD approval line. This ignores the ListObjectsV2 calls archive-sync makes.

**Build time.** 06-15's comparable all-pages-changed deploy took about 1,070 s in total (build
command about 631 s) against the 1,200 s Workers Builds ceiling. Whether that ceiling applies to
the build command only or to the whole build is still unverified (06-15 open follow-up). This is
carried over from 06-15, not a measurement of this branch.

**D1.** No extra reads expected: the loader stays warm and only rendering changes. Not measured.

### 6. What Jaime does (Task 2, not done by Claude)

1. In lazygit: merge `feature/phase-07` into `develop`, then `develop` into `main`; push both.
2. Cloudflare dashboard, Workers & Pages, `915tldr-v2`, Settings, Build, Variables: confirm
   `ARTICLES_FORCE_COLD`, `ASTRO_INCREMENTAL_BUILD` and `ALLOW_FALLBACK_HOT_WINDOW` are **not set**.
   Add no share-origin variable (none is used; the origin is a guarded constant in code). If any
   variable is edited, re-check the non-production trigger afterwards (dashboard saves write to
   both triggers, project memory 2026-09-30).
3. Reply "pushed" with the main merge commit hash.

### 7. What was not verified in this section

- Live `/version.json` `builtAt` before the deploy was not captured (the checker reports the commit
  only); Task 3 needs only the post-push value.
- `dist/archive-plan.json` and `dist/client/static-budget.json` are from the 2026-10-04 local
  build and are stale. No build was run (4a). Today's real object and file counts were not measured.
- That the stylesheet href will not change is an expectation from the diff, not a measurement.
- The Workers Builds time limit scope, the account's R2 free tier, and any per-file static-asset
  charge were not checked.
- Nothing was checked in a real share scraper; no dev server was started; no database access.
