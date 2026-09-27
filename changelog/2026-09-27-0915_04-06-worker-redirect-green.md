# 2026-09-27 - GREEN: implement article-redirect and the Worker fetch handler (04-06 Task 1)

**Keywords:** [FEATURE] [SECURITY] [BACKEND] [ROUTING] [BUG_FIX]
**Session:** Morning, Duration (~15 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-27-0915_04-06-worker-redirect-green.md`

## What Changed

- File: `src/lib/article-redirect.ts`
  - `extractArticleUuid(pathname)`: decodes the pathname inside try/catch (malformed
    percent-encoding -> `null`, never a throw), matches a 36-char 8-4-4-4-12 hex uuid
    (case-insensitive) ending the last path segment — preceded by `/` or `-`, optionally
    followed by `.html` and/or one trailing slash — and returns it lowercased. D-09: an 8-char
    short id never matches this pattern at all.
  - `resolveRedirect(pathname, entry)`: validates `entry` (object, `schemaVersion === '2'`,
    `articleId` matches `UUID_RE`, `category` matches `CATEGORY_SLUG_RE`, `slug` matches
    `ARTICLE_SLUG_RE` — which also excludes `/`), builds the canonical path via the existing
    `articlePath()`, and returns `not-found` if the request path already equals the canonical
    (loop guard) or if any validation fails. T-04-22: the returned `location` is built ONLY from
    validated manifest fields, never from the request path — always same-origin, never `//` or a
    host.
- File: `src/worker.ts`
  - Default `fetch(request, env)` export: non-GET/HEAD or no uuid in the path ->
    `env.ASSETS.fetch(request)` with zero KV calls; otherwise one
    `env.RENDER_MANIFEST.get('manifest:<uuid>', 'json')` inside try/catch (KV error -> log
    without headers/cookies, then fall through to assets, never a 500); `resolveRedirect` decides
    a 301 (`Location` = canonical + original query string, `Cache-Control: public,
    max-age=3600`) or a fallthrough to the static 404. Minimal local `Env` interface (no
    `@cloudflare/workers-types` dependency exists in this project).

## Why

Phase 4 Plan 06, Task 1 GREEN: this project's first Worker (D-08) exists to keep nine months of
indexed URLs resolving via one 301 with one KV read and zero D1 reads, capped at the Worker's own
5ms CPU budget.

## Issues Encountered

**Acceptance-criteria self-check caught two literal-text false positives.** The plan's own
acceptance criteria (`grep -c "lib/server" ... reports 0`, `grep -c "RENDER_MANIFEST.get" ...
returns 1`) are blind text greps that don't distinguish code from comments — the first draft's
explanatory comments spelled out the forbidden directory path and repeated the KV-read method
name in a log message, both of which the grep matched even though neither was a real import or a
second KV call. Reworded both comments to describe the same constraint without the literal
matched substrings; re-ran the greps and the full test suite to confirm both now read exactly the
required counts with no behavior change.

## Dependencies

No dependencies added — confirmed no `@cloudflare/workers-types` package exists in
`node_modules`, so `Env` is a minimal local interface per the plan's own fallback instruction.

## Testing Notes

- What was tested: `node --test tests/unit/article-redirect.test.mjs tests/unit/worker.test.mjs`
  — 21/21 passing (GREEN); `grep -c "lib/server" src/worker.ts src/lib/article-redirect.ts` = 0
  for each; `grep -c "RENDER_MANIFEST.get" src/worker.ts` = 1; U+2028/U+2029 line-separator grep
  clean on all four files touched
- What wasn't tested: the Worker has not yet been wired into `wrangler.jsonc` or bundled by a
  real `wrangler deploy --dry-run` — that's Task 2
- Edge cases: covered by the RED commit's test suite (uuid case-insensitivity, trailing slash,
  `.html` suffix, D-09 short ids, malformed encoding, loop guard, stale schema version, invalid
  category/slug, open-redirect safety, KV-throw fallthrough, non-GET fallthrough)

## Next Steps

- [ ] Task 2: wire `main: "src/worker.ts"` into `wrangler.jsonc` with navigation-safe routing
      (`assets_navigation_has_no_effect`, `not_found_handling`, `html_handling`) and extend
      `tools/assert-no-d1.mjs`'s `ENTRYPOINT_EXACT_FILES`
- [ ] Task 3: static 404 page with build-time suggestion index, `public/_redirects`

---

**Branch:** feature/phase-04
**Issue:** N/A
**Impact:** MEDIUM - first Worker in this project; the redirect-decision logic is
security-sensitive (open-redirect mitigation) and fully unit-tested before wiring
