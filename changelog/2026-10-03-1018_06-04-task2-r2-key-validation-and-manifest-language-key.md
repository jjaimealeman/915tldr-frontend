# 2026-10-03 - R2 Key Validation, Archive-Sync Self-Heal and the Language-Aware KV Manifest Key

**Keywords:** [BACKEND] [FEATURE] [TESTING] [SECURITY] [I18N]
**Session:** Morning, Duration (~20 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-03-1018_06-04-task2-r2-key-validation-and-manifest-language-key.md`

## What Changed

- File: `src/lib/server/r2-client.ts`
  - Added anchored `ARCHIVE_ES_ARTICLE_KEY_RE`/`ARCHIVE_ES_TAG_KEY_RE` (same uuid/slug character
    classes as their English counterparts, one segment deeper under `es/`)
  - `assertArchiveKey` now accepts `es/articles/<uuid>.html` and `es/tags/<slug>.html`, still
    rejecting traversal (`es/articles/../x.html`, `/es/tags/a.html`, `es/tags/a.html/../../b`)
  - `ARCHIVE_PREFIXES` extended with `'es/articles/'`/`'es/tags/'`
- File: `tools/archive-sync.mjs`
  - The WR-02 pre-sync self-heal block now lists all four archive prefixes
    (`articles/`, `tags/`, `es/articles/`, `es/tags/`), so an indexed-but-missing Spanish object
    re-uploads as new exactly like an English one
- File: `src/lib/server/kv-manifest.ts`
  - `manifestKey(articleId, language = 'en')` is now exported and language-aware: `'en'` keeps
    the unchanged `manifest:<uuid>` key, `'es'` lands at its own `manifest:<uuid>:es` — closed
    `en | es` enum, throws `kv-manifest: invalid manifest language ...` on anything else
  - `putManifestEntry`/`putManifestEntriesBulk` now key by `(articleId, entry.language)`;
    `getManifestEntry` takes an optional `language` (default `'en'`)
  - `deleteManifestEntries` is unchanged — still deletes the English identity keys it deletes
    today
  - `listManifestArticleIds` skips any key name ending `:es`
  - Rewrote the `ManifestEntry.translationGroupId`/`language` doc comments to state the Phase 6
    key-scheme decision (`docs/phase-06/language-key-scheme.md`): the Worker reads the shared
    English identity entry for both languages; no Spanish entries are written this phase
  - `MANIFEST_SCHEMA_VERSION` left at `'2'` — the stored value shape is unchanged
- File: `tests/unit/r2-client.test.mjs`
  - Added the Spanish accept/reject matrix (`es/articles/...`, `es/tags/...`, traversal, wrong
    extension) and `listKeys` acceptance for the two new Spanish prefixes
- File: `tests/unit/archive-sync.test.mjs`
  - Added a self-heal test proving all four prefixes are listed and a missing Spanish object
    re-uploads as new, plus a `moveEntriesBack` test for a Spanish entry restoring into
    `dist/client/es/...`
- File: `tests/unit/manifest-schema.test.mjs`
  - Added `manifestKey` coverage (default/explicit `'en'`, `'es'`, invalid-language throw),
    a mixed `en`+`es` `putManifestEntriesBulk` call proving distinct keys, `getManifestEntry`'s
    language param, and `listManifestArticleIds` skipping a `:es`-suffixed key

## Why

Task 2 of 06-04-PLAN.md — the R2/KV half of teaching the archive-tier build/sync pipeline about
Spanish pages. Pairs with Task 1's partition-side changes (committed earlier this session,
`53b2ed5`): Spanish archive objects now validate, upload, self-heal and clean up exactly like
English ones, and the KV manifest key can no longer collide across languages even though no
Spanish manifest entry is written yet.

## Issues Encountered

No major issues encountered. Every abuse case named in the plan's behavior block (Spanish
traversal, malformed-language key injection, self-heal across all four prefixes) was closed by
a small, structurally consistent extension of the existing English pattern — no surprises.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: every behavior bullet in 06-04-PLAN.md Task 2. Ran `node --test
  tests/unit/r2-client.test.mjs tests/unit/archive-sync.test.mjs tests/unit/manifest-schema.test.mjs`
  (124/124 pass) and `pnpm run test:fast` (837/837 pass) before committing, plus
  `pnpm run test:build-gate` (9/9 pass, confirming `kv-manifest.ts`/`r2-client.ts` stayed inside
  the D1/KV chokepoint directory guard).
- What wasn't tested: a real production KV write of an `'es'`-language entry — no caller writes
  one yet (the decision in `docs/phase-06/language-key-scheme.md` is that no Spanish manifest
  entry is written this phase); the new `manifestKey`/`getManifestEntry(..., {language:'es'})`
  path is proven correct via stubbed fetch only.
- Edge cases: Spanish key traversal/leading-slash/trailing-garbage/wrong-extension rejections,
  an indexed-but-R2-missing Spanish object, a Spanish entry restored by `moveEntriesBack`, a
  mixed-language bulk write for the same uuid, and a `:es`-suffixed key being excluded from
  `listManifestArticleIds`.

## Next Steps

- [ ] Write and commit 06-04-SUMMARY.md
- [ ] Later plans (06-09/06-10) wire the actual `/es` routes and backfill that produce real
      Spanish tier facts and (if ever needed) Spanish manifest entries against this now-proven
      key scheme

---

**Branch:** feature/phase-06
**Issue:** N/A
**Impact:** MEDIUM - build/sync tooling and a build-time-only KV helper; no production behavior
changes (no caller writes a Spanish manifest entry yet), proven via stub/fixture tests ahead of
06-09/06-10
