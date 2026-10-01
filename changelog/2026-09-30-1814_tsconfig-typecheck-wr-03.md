# 2026-09-30 - Add tsconfig.json and a typecheck script, fix the 14 real type errors found (04-REVIEW WR-03)

**Keywords:** [BACKEND] [FRONTEND] [TESTING] [CONFIG]
**Session:** Evening, Duration (~45 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-30-1814_tsconfig-typecheck-wr-03.md`

## What Changed

- File: `tsconfig.json` (new)
  - Extends `astro/tsconfigs/strict`, includes `.astro/types.d.ts`/`**/*.ts`/`**/*.astro`,
    excludes `dist` and `design`.
- File: `package.json`
  - Added a `typecheck` script (`astro check`), left as a standalone script — NOT wired into
    `build` or `test:unit` per this task's own instruction.
  - Added devDependencies `@astrojs/check@0.9.10` and `typescript@6.0.3` (exact pins). Note:
    `typescript@7.0.2` is the npm `latest` dist-tag, but `@astrojs/check@0.9.10`'s own
    `peerDependencies` require `typescript: ^5.0.0 || ^6.0.0` — TypeScript 7 does not satisfy that
    range, so `6.0.3` (the newest version that does) was pinned instead of blindly taking
    `latest`. Both packages verified against their real npm registry entries and GitHub repos
    (`withastro/astro`, `microsoft/TypeScript`) before install.
  - `pnpm-lock.yaml` updated by the install.
- File: `src/content/loaders/articles-loader.ts`
  - Fixed 2 real `ts(2322)` errors: `parseData({ id, data: article })` passed a `PublicArticle`
    (a named interface with no index signature) where `Record<string, unknown>` was required; cast
    to `article as unknown as Record<string, unknown>` at both call sites (cold and warm/sweep
    branches).
- File: `src/pages/404.astro`
  - Fixed 9 real errors in the inline suggestions script: added parameter types to `tokenize`,
    `wordsOf`, `scoreEntry`, `validEntry` (the last as a `entry is IndexEntry` type guard),
    typed `wordSet` as `Record<string, boolean>`, and changed `section`/`list` from `var` to
    `const` (capturing them as `safeSection`/`safeList`) so their null-checked narrowing survives
    into the `.then()` closure instead of widening back to `Element | null`. Behavior unchanged —
    every DOM write is still createElement/setAttribute/textContent only (T-04-25).
- File: `src/pages/[category]/[slug].astro`
  - Fixed 2 real errors: declared an explicit `Props` interface using `astro:content`'s own
    `CollectionEntry<'articles'>['data']` type (not an import from `articles-loader.ts`, which also
    exports D1-fetch functions `tools/assert-no-d1.mjs`'s guard specifically polices pages against
    reaching, even via a type-only import), and added an explicit `{ slug: string; name: string }`
    parameter type to both `article.tags.map((tag) => ...)` call sites.

## Why

`04-REVIEW.md` (WR-03) found no `tsconfig.json` anywhere in the repo — confirmed to be the real
cause of the reported "Cannot find module 'astro:content'"/implicit-any editor symptom, not an
editor quirk, and the repo had zero static type-checking in its test/CI pipeline (`test:unit` runs
`astro build` + `node --test` only, which strips types without checking them). Running `astro
check` against the new `tsconfig.json` surfaced 14 real errors across 48 files — a manageable
count per this task's own threshold (<=40) — so all 14 were fixed rather than deferred, without
weakening strictness anywhere (no `any`, no `@ts-ignore`; every fix is a correct, narrow type
annotation or a `const`-for-narrowing change).

## Issues Encountered

Running `pnpm run typecheck` (or a bare `astro sync`) always exits with code 1 in this repo, even
after the fix (0 real type errors remain) — NOT because of a type error, but because
`tools/assert-no-d1.mjs`'s guard is registered as a Vite/Rollup plugin in `astro.config.mjs` and
fires on every Vite build Astro runs internally, including the content-sync pass `astro check`/
`astro sync` triggers. That sync-only pass never bundles `src/pages/**`, so the guard's own
"matched zero candidate files" fail-loud check (D-06, intentional-by-design) trips every time,
independent of any real type error. This is a pre-existing architectural interaction between the
project's own build-time D1 guard and any standalone `astro check`/`astro sync` invocation, not
introduced by this fix and out of scope to change (the guard's fail-loud behavior on zero
candidates is itself a deliberate safety property, not a bug). The actual typecheck result is
still visible in stdout above that exit: `Result (48 files): - 0 errors - 0 warnings - 0 hints`.

## Dependencies

Added: `@astrojs/check@0.9.10` (dev, enables `astro check`), `typescript@6.0.3` (dev, pinned below
`latest` 7.0.2 specifically for `@astrojs/check` peer-dependency compatibility).

## Testing Notes

- What was tested: `pnpm run typecheck` run to completion, 14 -> 0 real errors confirmed in its
  own diagnostic output; full `pnpm run test:unit` (390/390 passing) and `pnpm run test:build-gate`
  (8/8 passing) re-run after every fix to confirm no runtime regression, with all 04-followups
  changes applied together.
- What wasn't tested: `pnpm run typecheck`'s own process exit code was NOT made to return 0 (see
  Issues Encountered) — this is a known, documented limitation of running it standalone in this
  repo, not a gap in the type-level fixes themselves.
- Edge cases: confirmed the `Props` interface on `[category]/[slug].astro` sources its article
  type from `astro:content` directly rather than re-exporting from a D1-adjacent module, to avoid
  any risk to the project's zero-D1-on-public-path guarantee.

## Next Steps

- [ ] Optional, not required by this task: investigate whether `assert-no-d1.mjs`'s Vite plugin
      can detect a sync-only invocation (vs. a real `astro build`) and skip its zero-candidate
      fail-loud check in that case, so `pnpm run typecheck` can exit 0 cleanly on success.

---

**Branch:** feature/fix/phase-04-followups
**Issue:** N/A
**Impact:** MEDIUM - adds a previously-missing static type-checking capability to the project and
fixes every real type error it found; `typecheck` stays a separate, non-blocking script as
instructed.
