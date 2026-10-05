---
phase: 06-bilingual
plan: 04
subsystem: infra
tags: [cloudflare-r2, cloudflare-kv, i18n, build-tooling, archive-tier]

# Dependency graph
requires:
  - phase: 06-bilingual (plan 06-02)
    provides: "articleArchiveKey(id, language)/tagArchiveKey(slug, language) in archive-route.ts, localizedPath/languageOfPath/LANGUAGES/assertLanguage in article-url.ts, and the key-scheme decision (docs/phase-06/language-key-scheme.md)"
  - phase: 05-hybrid-archive-zero-reads-proof
    provides: "tier-facts.ts/partition-archive.mjs's build-time archive-tier split, r2-client.ts's assertArchiveKey chokepoint, archive-sync.mjs's pre-sync self-heal, kv-manifest.ts's render-manifest writer"
provides:
  - "Spanish tier facts (ArticleTierFactEs/TagTierFactEs, writeArticleFactsEs/writeTagFactsEs) and readTierFacts()'s articlesEs/tagsEs"
  - "Spanish partition entries (es/articles/<uuid>.html, es/tags/<slug>.html) classified per translation group, keyed via archive-route.ts's single source of truth"
  - "countBuiltSpanishPages()/assertSpanishFactsMatchBuilt() — a fail-loud built-files-vs-facts consistency check for the /es tier"
  - "r2-client.ts's assertArchiveKey/ARCHIVE_PREFIXES accept the two Spanish archive key shapes"
  - "archive-sync.mjs's pre-sync self-heal lists all four archive prefixes (articles/, tags/, es/articles/, es/tags/)"
  - "kv-manifest.ts's exported, language-aware manifestKey(articleId, language) — manifest:<uuid> (en, unchanged) / manifest:<uuid>:es (es), structurally collision-free"
affects: [06-09-es-article-route, 06-10-es-backfill, 06-11-es-sitemap]

# Actuals (#2632)
actuals:
  tokens: 12950
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single source of key truth: partition-archive.mjs's English entries were switched to the same articleArchiveKey/tagArchiveKey functions the Spanish entries use, removing a second hand-rolled template string that could have drifted from the Worker's own key derivation"
    - "Optional-with-required-shape facts files: readFactsFileOptional treats a missing Spanish facts file as [] (no /es routes built yet) but still fails loud on a present-but-malformed one — same discipline as the required English files, just with a different missing-file outcome"
    - "Language-aware key function with a closed enum and an unchanged default (manifestKey/articleArchiveKey/tagArchiveKey all follow this shape): the English path is byte-for-byte identical to before the dimension was added, and the new language value gets its own structurally separate key"

key-files:
  created: []
  modified:
    - src/lib/archive/tier-facts.ts
    - tools/partition-archive.mjs
    - src/lib/server/r2-client.ts
    - tools/archive-sync.mjs
    - src/lib/server/kv-manifest.ts
    - tests/unit/tier-facts.test.mjs
    - tests/unit/partition-archive.test.mjs
    - tests/unit/r2-client.test.mjs
    - tests/unit/archive-sync.test.mjs
    - tests/unit/manifest-schema.test.mjs

key-decisions:
  - "No Spanish manifest entry is written by this plan — manifestKey(id, 'es') exists so a future writer structurally cannot collide with the English entry, matching 06-02's own no-change-to-KV-identity decision (docs/phase-06/language-key-scheme.md)"
  - "Spanish facts files are optional-but-validated: absent is a valid pre-06-09/06-10 state ([]), present-and-malformed still throws — never a silent partial result either way"

patterns-established:
  - "A facts/built-files consistency check (assertSpanishFactsMatchBuilt) runs before planning, mirroring REND-11's existing fail-loud discipline, extended to the Spanish tier"

requirements-completed: []  # I18N-04 remains Pending in REQUIREMENTS.md — this plan proves the build/sync half of the /es archive tier (partition, R2 key validation, self-heal, manifest key), not the full requirement (no /es route tree exists yet; that's 06-09/06-10). Matches this phase's own established precedent (06-02-SUMMARY.md) of not marking a requirement complete until the full behavior it describes is live.

coverage:
  - id: D1
    description: "Given English and Spanish tier facts, the partition plan holds an entry per archived Spanish article (es/articles/<uuid>.html) and tag (es/tags/<slug>.html), with keys from archive-route's articleArchiveKey/tagArchiveKey rather than a second string template"
    requirement: "I18N-04"
    verification:
      - kind: unit
        ref: "tests/unit/partition-archive.test.mjs#planPartition: Spanish facts yield es/articles and es/tags entries alongside English ones, with Es counts"
        status: pass
      - kind: other
        ref: "grep -n \"articles/\\${\" tools/partition-archive.mjs — prints nothing"
        status: pass
    human_judgment: false
  - id: D2
    description: "A Spanish article/tag is archive-tier exactly when its English counterpart is — tiering is per translation group, never per language"
    requirement: "I18N-04"
    verification:
      - kind: unit
        ref: "tests/unit/partition-archive.test.mjs#planPartition: Spanish facts yield es/articles and es/tags entries alongside English ones, with Es counts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Partition fails loud when the built /es article/tag HTML file count differs from the Spanish facts count, and is a no-op when neither exists"
    verification:
      - kind: unit
        ref: "tests/unit/partition-archive.test.mjs#assertSpanishFactsMatchBuilt: throws \"partition-archive:\" when built /es article pages do not match Spanish tier facts"
        status: pass
      - kind: unit
        ref: "tests/unit/partition-archive.test.mjs#assertSpanishFactsMatchBuilt: does not throw when counts match, including the zero/zero no-op case"
        status: pass
    human_judgment: false
  - id: D4
    description: "A Spanish tier fact whose path is not /es/-prefixed, does not end with its own uuid, or omits/misshapes translated is rejected with a tier-facts: error"
    verification:
      - kind: unit
        ref: "tests/unit/tier-facts.test.mjs#readTierFacts: a Spanish article fact whose path is not /es/-prefixed is rejected with a \"tier-facts:\" error"
        status: pass
      - kind: unit
        ref: "tests/unit/tier-facts.test.mjs#readTierFacts: a Spanish article fact whose path does not end with its own uuid is rejected with a \"tier-facts:\" error"
        status: pass
      - kind: unit
        ref: "tests/unit/tier-facts.test.mjs#readTierFacts: a Spanish article fact missing/misshaping \"translated\" is rejected with a \"tier-facts:\" error"
        status: pass
    human_judgment: false
  - id: D5
    description: "r2-client's assertArchiveKey accepts es/articles/<uuid>.html and es/tags/<slug>.html and still rejects traversal and malformed shapes"
    requirement: "I18N-04"
    verification:
      - kind: unit
        ref: "tests/unit/r2-client.test.mjs#assertArchiveKey accepts a lowercase-uuid Spanish article key"
        status: pass
      - kind: unit
        ref: "tests/unit/r2-client.test.mjs#assertArchiveKey rejects a Spanish traversal attempt"
        status: pass
      - kind: unit
        ref: "tests/unit/r2-client.test.mjs#assertArchiveKey rejects a Spanish tag key with a leading slash"
        status: pass
    human_judgment: false
  - id: D6
    description: "archive-sync's pre-sync self-heal lists all four archive prefixes, so an indexed-but-missing Spanish object re-uploads as new; moveEntriesBack restores a Spanish entry into dist/client/es/..."
    requirement: "I18N-04"
    verification:
      - kind: unit
        ref: "tests/unit/archive-sync.test.mjs#archive-sync: runPreSync self-heal lists all four archive prefixes (articles/, tags/, es/articles/, es/tags/), so an indexed-but-missing Spanish object re-uploads as new"
        status: pass
      - kind: unit
        ref: "tests/unit/archive-sync.test.mjs#archive-sync: moveEntriesBack restores a Spanish entry to dist/client/es/... (REND-08 no-404-window invariant, Spanish side)"
        status: pass
    human_judgment: false
  - id: D7
    description: "manifestKey(id, 'en') is manifest:<uuid> (unchanged) and manifestKey(id, 'es') is manifest:<uuid>:es, so a Spanish entry can never overwrite the English one; listManifestArticleIds never returns a ':es'-suffixed id"
    requirement: "I18N-04"
    verification:
      - kind: unit
        ref: "tests/unit/manifest-schema.test.mjs#manifestKey(id, \"es\") returns a distinct key that can never collide with the English entry"
        status: pass
      - kind: unit
        ref: "tests/unit/manifest-schema.test.mjs#listManifestArticleIds with stub keys [manifest:a, manifest:a:es] returns only [a] — a \":es\" key is never a second id"
        status: pass
      - kind: unit
        ref: "tests/unit/manifest-schema.test.mjs#putManifestEntriesBulk with one \"en\" and one \"es\" entry for the same uuid sends distinct keys manifest:<uuid> and manifest:<uuid>:es"
        status: pass
    human_judgment: false
  - id: D8
    description: "No English key, index, or manifest behavior changed — pnpm run test:fast exits 0 across the full pre-existing suite"
    verification:
      - kind: unit
        ref: "pnpm run test:fast (837/837 pass, full pre-existing suite plus this plan's new tests)"
        status: pass
      - kind: other
        ref: "pnpm run test:build-gate (9/9 pass — kv-manifest.ts/r2-client.ts stay inside the D1/KV chokepoint directory guard)"
        status: pass
    human_judgment: false

duration: ~15min
completed: 2026-10-03
status: complete
---

# Phase 6 Plan 04: Archive-Tier Build/Sync Pipeline Gains a Spanish Dimension Summary

**Spanish archive-tier pages now partition onto their own `es/`-prefixed R2 keys with the same
hot/archive tiering as English, validate and self-heal in `archive-sync.mjs` exactly like English
objects, and get a structurally collision-free KV manifest key — with zero changes to any existing
English key, index entry, or manifest behavior.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-10-03
- **Tasks:** 2
- **Files modified:** 10 (5 source, 5 test)

## Accomplishments

- `tier-facts.ts` gained `ArticleTierFactEs`/`TagTierFactEs`, `writeArticleFactsEs`/
  `writeTagFactsEs`, and `readTierFacts()`'s new `articlesEs`/`tagsEs` fields — `[]` when the
  Spanish facts files don't exist yet (the state every build is in until 06-09/06-10 add the
  `/es` routes), fully validated (including a required `translated` boolean and a `/es/`-prefix
  path check) when present.
- `partition-archive.mjs`'s `planPartition` classifies Spanish facts per translation group with
  the SAME `classifyArticles`/`classifyTags` cutoff as their English counterparts, emitting
  `es/articles/<uuid>.html`/`es/tags/<slug>.html` entries. Both English and Spanish entry keys
  now come from `archive-route.ts`'s `articleArchiveKey`/`tagArchiveKey` — the English side lost
  its old hand-rolled `articles/${uuid}.html` template string in the same change, so there is
  exactly one function in the codebase that knows the archive key shape.
- New `countBuiltSpanishPages()`/`assertSpanishFactsMatchBuilt()` give the build CLI a fail-loud
  check that the built `/es` HTML file count matches the Spanish tier facts count, before
  planning — a facts/files mismatch (REND-11's own discipline, extended to the Spanish tier)
  can no longer pass silently.
- `r2-client.ts`'s `assertArchiveKey` chokepoint and `ARCHIVE_PREFIXES` now accept the two
  Spanish archive key shapes (`es/articles/`, `es/tags/`), with the same traversal/malformed-shape
  rejections as the English keys.
- `archive-sync.mjs`'s WR-02 pre-sync self-heal lists all four archive prefixes, so an
  indexed-but-R2-missing Spanish object re-uploads as new instead of silently staying "unchanged"
  — and `moveEntriesBack` (already path-generic) was proven to correctly restore a Spanish entry
  into `dist/client/es/...`.
- `kv-manifest.ts`'s `manifestKey(articleId, language)` is now exported and language-aware:
  `'en'` (default) is the byte-for-byte unchanged `manifest:<uuid>` key; `'es'` lands at its own
  `manifest:<uuid>:es`, so a future Spanish entry structurally cannot overwrite the English one,
  even though no caller writes a Spanish entry this phase (matching 06-02's own KV-identity
  no-change decision). `listManifestArticleIds` now skips `:es`-suffixed keys.

## Task Commits

Each task was committed atomically:

1. **Task 1 (tracer): Spanish facts in, Spanish archive entries out** - `53b2ed5` (feat)
2. **Task 2: R2 key validation, archive-sync listing and the language-aware manifest key** - `648ca8f` (feat)

**Plan metadata:** this file's own commit (docs: complete plan)

_Note: Task 1 is this plan's `type="tracer"`/`tdd="true"` task — before committing it, the full
Task 1 verification (`node --test` on both tier-facts/partition-archive test files, plus the
full `pnpm run test:fast`) was run and passed, and the result was confirmed at an interactive
tracer-feedback checkpoint before Task 2 began ("Approved, continue")._

## Files Created/Modified

- `src/lib/archive/tier-facts.ts` - `ARTICLE_FACTS_ES_PATH`/`TAG_FACTS_ES_PATH`,
  `ArticleTierFactEs`/`TagTierFactEs`, `writeArticleFactsEs`/`writeTagFactsEs`,
  `readTierFacts()`'s new `articlesEs`/`tagsEs`
- `tools/partition-archive.mjs` - Spanish plan entries, `hotArticlesEs`/`archivedArticlesEs`/
  `hotTagsEs`/`archivedTagsEs` counts, `countBuiltSpanishPages()`, `assertSpanishFactsMatchBuilt()`
- `src/lib/server/r2-client.ts` - `ARCHIVE_ES_ARTICLE_KEY_RE`/`ARCHIVE_ES_TAG_KEY_RE`, extended
  `ARCHIVE_PREFIXES`
- `tools/archive-sync.mjs` - self-heal listing extended to all four archive prefixes
- `src/lib/server/kv-manifest.ts` - exported, language-aware `manifestKey`; `putManifestEntry`/
  `putManifestEntriesBulk`/`getManifestEntry` key by language; `listManifestArticleIds` skips
  `:es` keys
- `tests/unit/tier-facts.test.mjs` - hermetic temp-dir/`process.chdir` fixtures for every Spanish
  facts behavior bullet
- `tests/unit/partition-archive.test.mjs` - Spanish `planPartition`/`applyPartition`/
  `countBuiltSpanishPages`/`assertSpanishFactsMatchBuilt` coverage
- `tests/unit/r2-client.test.mjs` - Spanish accept/reject matrix, `listKeys` prefix acceptance
- `tests/unit/archive-sync.test.mjs` - self-heal four-prefix listing, Spanish `moveEntriesBack`
- `tests/unit/manifest-schema.test.mjs` - `manifestKey`, mixed-language bulk write,
  `listManifestArticleIds` `:es`-skip coverage

## Decisions Made

- No Spanish manifest entry is written by this plan — `manifestKey(id, 'es')` exists purely as a
  structural guarantee for a future writer, per 06-02's own decision that the KV render-manifest
  identity entry stays `no-change` (`docs/phase-06/language-key-scheme.md`).
- Spanish facts files are optional: absent is a valid "no `/es` routes yet" state (`[]`); present
  but malformed still fails loud — matching the English files' required-and-validated discipline
  everywhere except the missing-file outcome.

## Deviations from Plan

None — plan executed exactly as written. Every behavior bullet in both tasks' `<behavior>`
blocks is a named passing test; every acceptance-criteria grep in the plan passes.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The archive-tier build/sync pipeline (partition → R2 validation/self-heal → manifest key) is
  fully Spanish-aware and proven via fixture tests, ready for 06-09/06-10 to wire the real `/es`
  article/tag routes and write real Spanish tier facts against it.
- I18N-04 remains `Pending` in REQUIREMENTS.md — this plan proves the build/sync half of the
  `/es` archive tier, not the full requirement (no `/es` route tree exists yet). No blockers for
  subsequent plans.

---
*Phase: 06-bilingual*
*Completed: 2026-10-03*

## Self-Check: PASSED

All files modified verified present on disk (`src/lib/archive/tier-facts.ts`,
`tools/partition-archive.mjs`, `src/lib/server/r2-client.ts`, `tools/archive-sync.mjs`,
`src/lib/server/kv-manifest.ts`, and the five corresponding test files). Both task commits
(`53b2ed5`, `648ca8f`) confirmed present in `git log --oneline --all`.
