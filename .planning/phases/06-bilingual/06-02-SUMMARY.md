---
phase: 06-bilingual
plan: 02
subsystem: infra
tags: [cloudflare-workers, kv, r2, i18n, routing, security]

# Dependency graph
requires:
  - phase: 03-foundation-read-budget-guardrails
    provides: "translationGroupId + language identity shape on the render manifest (D-04)"
  - phase: 05-hybrid-archive-zero-reads-proof
    provides: "R2 archive tier and the Worker's archive-serving branch (articleArchiveKey/tagArchiveKey, serveArchived)"
provides:
  - "Language-aware canonical-path builder (articlePath/localizedPath/languageOfPath) in article-url.ts, Worker-safe, no src/lib/server/ imports"
  - "resolveRedirect carries a derived-from-path language on every canonical/redirect decision"
  - "Language-qualified R2 archive keys (es/articles/<uuid>.html, es/tags/<slug>.html) via articleArchiveKey/tagArchiveKey's new language param"
  - "Worker's archive-tier branch serves /es requests on their own R2 keys with the same single-KV-read budget as English"
  - "Recorded key-scheme decision (no-change for KV identity, add-alongside for R2) in docs/phase-06/language-key-scheme.md"
affects: [06-bilingual-route-tree, 06-bilingual-backfill, 06-bilingual-manifest-writer]

# Actuals (#2632)
actuals:
  tokens: 11740
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Closed enum + assertX(value) never-coerce validation extended to a new dimension (Language), mirroring article-url.ts's existing assertMatches convention"
    - "Language derived exclusively from a fixed, case-sensitive path-prefix test (languageOfPath) — never from a header, cookie or request.cf (D-13)"
    - "Add-alongside key scheme: new dimension gets a prefix: existing data and keys are byte-for-byte unchanged (same philosophy as D-01's article_translations sibling table)"

key-files:
  created:
    - tests/unit/article-url.test.mjs
    - docs/phase-06/language-key-scheme.md
  modified:
    - src/lib/article-url.ts
    - src/lib/article-redirect.ts
    - src/lib/archive/archive-route.ts
    - src/worker.ts
    - tests/unit/worker.test.mjs
    - tests/unit/article-redirect.test.mjs
    - tests/unit/archive-route.test.mjs

key-decisions:
  - "KV render-manifest identity entry stays no-change (manifest:<uuid> alone) — language is derived from the validated path prefix at read time, not stored as a second key, because category/slug/articleId are untranslated and the same record answers both /x and /es/x with one KV read"
  - "R2 archive keys are add-alongside (es/articles/<uuid>.html, es/tags/<slug>.html) rather than promote (renaming ~30,500 existing English objects) — zero cost to existing data, reversibility rated costly not one-way"
  - "languageOfPath is case-sensitive and matches only the exact first path segment, so /escuela/..., /es-mx/... and /ES/... are all 'en' (I18N-04 adjacency)"

patterns-established:
  - "Language dimension threaded through articlePath/localizedPath/resolveRedirect/articleArchiveKey/tagArchiveKey/matchTagPath as an explicit, validated parameter with an 'en' default — every existing English call site is a no-op change"

requirements-completed: []  # I18N-04 and I18N-08 remain Pending in REQUIREMENTS.md — this plan proves the archive-tier /es serving and header-indifference INSTRUMENTS, not the full requirements (no /es route tree exists yet; I18N-08's zone-level-rules caveat is explicitly flagged unresolved in the plan). Matches this project's own established precedent (05-02/05-04) of not marking a requirement complete until the full behavior it describes is live.

coverage:
  - id: D1
    description: "A GET for an archived /es/<category>/<slug>-<uuid> request performs exactly one KV read (manifest:<uuid>) and reads the es/articles/<uuid>.html R2 key, 200"
    requirement: "I18N-04"
    verification:
      - kind: unit
        ref: "tests/unit/worker.test.mjs#worker: GET /es/<category>/<slug>-<uuid> for an archived article does exactly one KV read (manifest:<uuid>) and reads the es R2 key, 200"
        status: pass
    human_judgment: false
  - id: D2
    description: "A non-canonical /es path (wrong slug, wrong category, doubled /es/es/) redirects to the /es canonical, never to English"
    requirement: "I18N-04"
    verification:
      - kind: unit
        ref: "tests/unit/article-redirect.test.mjs#resolveRedirect: a non-canonical /es path (wrong slug) redirects to the /es canonical, never to English"
        status: pass
      - kind: unit
        ref: "tests/unit/article-redirect.test.mjs#resolveRedirect: a doubled /es/es/ prefix redirects to the single-/es canonical, never English"
        status: pass
    human_judgment: false
  - id: D3
    description: "English request behavior is byte-for-byte unchanged (same KV key, same R2 key, same 301 targets)"
    verification:
      - kind: unit
        ref: "pnpm run test:fast (809/809 pass, full pre-existing suite including every prior English-only worker/redirect/archive-route test)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The Worker never selects a language from Accept-Language, cookies or request.cf (D-13/I18N-08)"
    requirement: "I18N-08"
    verification:
      - kind: unit
        ref: "tests/unit/worker.test.mjs#worker: response is identical with and without Accept-Language/Cookie across /, English archived article, Spanish archived article and a non-canonical /es path (D-13)"
        status: pass
      - kind: other
        ref: "grep -nE \"headers\\.get\\(|request\\.cf|cookie\" src/worker.ts src/lib/article-redirect.ts src/lib/archive/archive-route.ts | grep -vE comment-lines — prints nothing"
        status: pass
    human_judgment: true
    rationale: "I18N-08 also depends on zone-level Cloudflare Transform/Redirect Rules outside this repo, which this plan explicitly does not and cannot audit (flagged unresolved in 06-02-PLAN.md's own 'Flagged assumption' section) — a human must confirm no such rule exists before I18N-08 is marked complete at the requirements level."
  - id: D5
    description: "Abuse cases: open redirect under /es, malformed-language key injection, path traversal through /es/tag/<slug> are all closed"
    verification:
      - kind: unit
        ref: "tests/unit/article-redirect.test.mjs#resolveRedirect: a doubled-slash /es path never leaks \"//\" or a host into the redirect Location"
        status: pass
      - kind: unit
        ref: "tests/unit/archive-route.test.mjs#articleArchiveKey: a language with trailing whitespace throws — no trimming"
        status: pass
      - kind: unit
        ref: "tests/unit/archive-route.test.mjs#matchTagPath: /es/tag/%2e%2e (path traversal under /es) is rejected"
        status: pass
    human_judgment: false

duration: ~45min
completed: 2026-10-03
status: complete
---

# Phase 6 Plan 02: Language-Aware Archive-Tier Routing Summary

**Worker-level language dimension (`en | es`) threaded through `article-url.ts`, `article-redirect.ts`, `archive-route.ts` and `worker.ts`, so an archived `/es` request serves from its own R2 key and never 301s silently back to English.**

## Performance

- **Duration:** ~45min
- **Completed:** 2026-10-03
- **Tasks:** 2
- **Files modified:** 9 (4 source, 4 test, 1 new doc)

## Accomplishments

- `article-url.ts` gained a closed `Language` enum (`'en' | 'es'`), `languageOfPath` (a fixed,
  case-sensitive path-prefix test — never a header/cookie/geo read), `localizedPath`, and a 4th
  `language` parameter on `articlePath`, all with zero `src/lib/server/` imports.
- `resolveRedirect` derives `language` from the request path alone and threads it through the
  canonical-path comparison, so a non-canonical `/es` request (wrong slug, wrong category,
  doubled `/es/es/`) redirects to the `/es` canonical — never to English — and vice versa.
- `archive-route.ts`'s `articleArchiveKey`/`tagArchiveKey` take an optional `language` parameter
  (default `'en'`, existing keys byte-for-byte unchanged); Spanish keys add alongside at an
  `es/` prefix. `matchTagPath` now also matches `/es/tag/<slug>`.
- `worker.ts`'s archive-serving branch now derives the R2 key from the detected language for both
  the tag-suffix redirect and the archived-article/tag serve path. The one `RENDER_MANIFEST.get`
  KV read per request is unchanged — still keyed by `manifest:<uuid>` alone, since the identity
  fields it holds (category, slug, articleId) are untranslated and answer both `/x` and `/es/x`.
- Task 2 pinned the above against its named threat-register entries (open redirect, key
  injection, path traversal, header/cookie-based language selection) with zero implementation
  changes required — every abuse case was already closed by Task 1's design.
- Recorded the key-scheme decision (`no-change` for the KV identity entry, `add-alongside` for R2
  keys, and why `promote` was rejected) in `docs/phase-06/language-key-scheme.md`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Tracer — an archived /es article request flows Worker → one KV read → es R2 key → 200, and a non-canonical /es path 301s to the /es canonical** - `0e8da66` (feat)
2. **Task 2: Abuse cases — open redirect, malformed language, Accept-Language indifference** - `9b914f4` (test)

**Plan metadata:** this file's own commit (docs: complete plan)

_Note: Task 1 ran the full plan verification (`node --test` on four unit files, `pnpm run
test:fast`, `pnpm run test:build-gate`) before commit, per its `tdd="true"`/`type="tracer"`
designation; Task 2 added abuse-case tests only, no implementation changes were needed._

## Files Created/Modified

- `src/lib/article-url.ts` - `LANGUAGES`, `Language`, `isLanguage`, `assertLanguage`,
  `SPANISH_PREFIX`, `languageOfPath`, `localizedPath`, `articlePath`'s new 4th parameter
- `src/lib/article-redirect.ts` - `resolveRedirect` derives and returns `language`; `RedirectDecision`'s
  `canonical` variant gained a `language` field
- `src/lib/archive/archive-route.ts` - `ARCHIVE_ES_PREFIX`, `articleArchiveKey`/`tagArchiveKey`
  gained a `language` parameter; `matchTagPath` detects `/es/tag/<slug>` and reports `language`
- `src/worker.ts` - tag-suffix redirect and archived-serve branches use the detected language for
  R2 key derivation
- `tests/unit/article-url.test.mjs` - new, full coverage for the language dimension
- `tests/unit/worker.test.mjs` - extended: `/es` archive-tier serving, non-canonical `/es` 301,
  Accept-Language/Cookie indifference sweep, malformed-encoding fallthrough
- `tests/unit/article-redirect.test.mjs` - extended: `/es` canonical/redirect cases, open-redirect
  abuse cases
- `tests/unit/archive-route.test.mjs` - extended: `/es/tag` matching, malformed-language throws
- `docs/phase-06/language-key-scheme.md` - new, records the key-scheme decision

## Decisions Made

- KV manifest identity entry: `no-change` (one shared entry serves both languages; language
  derived from the path, not stored twice). See `docs/phase-06/language-key-scheme.md`.
- R2 archive keys: `add-alongside` (`es/` prefix), rejecting `promote` (renaming all existing
  English keys) as a zero-benefit, high-cost migration.
- `languageOfPath` is case-sensitive and matches only the exact first path segment — a design
  choice that directly satisfies the I18N-04 adjacency requirement (`/escuela/...`, `/es-mx/...`,
  `/ES/...` are all English) without any extra code.

## Deviations from Plan

None — plan executed exactly as written. Task 2's abuse-case tests all passed against Task 1's
implementation with no code changes required; the plan itself anticipated this ("Write the tests
in the behavior block first; they should pass against Task 1's code").

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The archive-tier `/es` serving path is proven and tested; later plans in this phase can safely
  build the `/es` route tree, write Spanish manifest entries, and run the D-10 backfill knowing
  the storage/routing layer underneath them is collision-free.
- I18N-04 and I18N-08 remain `Pending` in REQUIREMENTS.md — this plan proves the archive-tier
  slice and the header-indifference instrument, not the full requirement (no `/es` route tree
  exists yet; I18N-08 also has an explicitly flagged, unresolved zone-level-rules caveat outside
  this repo's audit scope). No blockers for subsequent plans.

---
*Phase: 06-bilingual*
*Completed: 2026-10-03*

## Self-Check: PASSED

All files created/modified verified present on disk (`src/lib/article-url.ts`,
`src/lib/article-redirect.ts`, `src/lib/archive/archive-route.ts`, `src/worker.ts`,
`tests/unit/article-url.test.mjs`, `tests/unit/worker.test.mjs`,
`tests/unit/article-redirect.test.mjs`, `tests/unit/archive-route.test.mjs`,
`docs/phase-06/language-key-scheme.md`). Both task commits (`0e8da66`, `9b914f4`) confirmed
present in `git log --oneline --all`.
