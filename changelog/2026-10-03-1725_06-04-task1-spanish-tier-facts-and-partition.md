# 2026-10-03 - Spanish Tier Facts and Partition Entries for the Archive-Tier Build Pipeline

**Keywords:** [BACKEND] [FEATURE] [TESTING] [I18N]
**Session:** Afternoon, Duration (~25 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-03-1725_06-04-task1-spanish-tier-facts-and-partition.md`

## What Changed

- File: `src/lib/archive/tier-facts.ts`
  - Added `ARTICLE_FACTS_ES_PATH`/`TAG_FACTS_ES_PATH` constants
  - Added `ArticleTierFactEs` (extends `ArticleTierFact` with a required `translated: boolean`)
    and `TagTierFactEs` (alias of `TagTierFact`)
  - Added `writeArticleFactsEs()`/`writeTagFactsEs()` writers
  - `readTierFacts()` now also returns `articlesEs`/`tagsEs` — `[]` when the Spanish facts files
    are absent (no `/es` routes built yet this phase), fully validated when present
  - Spanish article validation extends the English rule with a `/es/`-prefix path check and a
    required `translated` boolean
- File: `tools/partition-archive.mjs`
  - `planPartition` takes `articleFactsEs`/`tagFactsEs` (default `[]`), classifies them with the
    same `classifyArticles`/`classifyTags` cutoff as their English counterparts (per translation
    group, never per language), and emits `es/articles/...`/`es/tags/...` entries
  - Both English and Spanish entry keys now come from `src/lib/archive/archive-route.ts`'s
    `articleArchiveKey`/`tagArchiveKey` — removed the hand-rolled `articles/${uuid}.html` /
    `tags/${slug}.html` template strings, so there is exactly one place that knows the key shape
  - Added `countBuiltSpanishPages()` and `assertSpanishFactsMatchBuilt()` — a fail-loud
    facts-vs-built-files consistency check for the `/es` tier, wired into the CLI's `main()`
    before planning
  - `cleanPartitionInputs` now also removes the two Spanish facts files
- File: `tests/unit/tier-facts.test.mjs`
  - Added hermetic temp-dir/`process.chdir` fixtures (no real build needed) covering
    `readTierFacts()`'s Spanish-facts-absent case and every Spanish validation failure mode
- File: `tests/unit/partition-archive.test.mjs`
  - Added coverage for Spanish `planPartition` entries/counts, a Spanish `applyPartition` move,
    and `countBuiltSpanishPages`/`assertSpanishFactsMatchBuilt`

## Why

This is Task 1 (the plan's `type="tracer"`) of 06-04-PLAN.md — teaching the build/sync half of
the archive tier about Spanish pages, ahead of 06-09/06-10 adding the actual `/es` routes.
Without this, every `/es` archived page would either stay stuck in the static output (blowing
past the file-count budget) or upload under a key the Worker's archive-serving branch (06-02)
never reads.

## Issues Encountered

No major issues encountered.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: every behavior bullet in 06-04-PLAN.md Task 1 — Spanish plan entries/keys/
  paths/sourceRel, a real byte-identical Spanish file move in `applyPartition`, `readTierFacts()`
  returning `[]` for absent Spanish facts, and every Spanish fact validation rejection path
  (`tier-facts:` prefix). Ran `node --test tests/unit/tier-facts.test.mjs
  tests/unit/partition-archive.test.mjs` (30/30 pass) and the full `pnpm run test:fast` (822/822
  pass) before committing.
- What wasn't tested: the real CLI entrypoint (`main()`) end-to-end against a live `astro build`
  with `/es` pages — no `/es` routes exist yet (06-09/06-10), so `assertSpanishFactsMatchBuilt`'s
  call site in `main()` is exercised as a pure function, not via a spawned process.
- Edge cases: zero-built/zero-facts no-op, a mismatched built-vs-facts count on both the article
  and tag side, a Spanish fact path missing its `/es/` prefix, and a Spanish fact path ending in
  the wrong uuid.

## Next Steps

- [ ] Task 2 of 06-04-PLAN.md: R2 key validation (`r2-client.ts`), archive-sync's self-heal
      listing of the two new Spanish prefixes, and the language-aware KV manifest key

---

**Branch:** feature/phase-06
**Issue:** N/A
**Impact:** MEDIUM - build/sync tooling only, no production behavior changes; proven independently via temp-dir fixtures ahead of 06-09/06-10 wiring real `/es` routes to it
