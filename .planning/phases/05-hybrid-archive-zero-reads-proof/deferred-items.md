# Deferred Items — Phase 5 (out of scope for this plan)

Scope boundary note, per execute-plan's deviation rules: only auto-fix issues directly caused
by the current task's changes. The item below pre-dates and is unrelated to 05-13..05-21's
gap-closure work; it is recorded here, not fixed here.

## 2026-10-02 — robots.txt test failures from commit 143eede (unrelated SEO change)

**Found during:** 05-21 Task 2's gap-closure full-suite re-run (`pnpm run test:unit` /
`pnpm run test:fast`).

**Failing tests:** `tests/unit/seo-surfaces.test.mjs`
- `seo-surfaces: robots.txt matches the fixture line-for-line except the Sitemap lines`
- `seo-surfaces: robots.txt preserves the Content-signal line and the per-bot AI-training blocks`

**Cause:** Commit `143eede` ("chore(seo): allow PerplexityBot and Perplexity-User in
robots.txt", 2026-10-02 17:59:00, this branch) added a new "AI ASSISTANTS / RAG - ALLOWED"
section to `public/robots.txt` that `Allow`s `PerplexityBot`/`Perplexity-User`, while
`tests/fixtures/v1-robots.txt` and the test's own bot-disallow list (line 61) still expect
`PerplexityBot` to be `Disallow`-ed alongside `GPTBot`/`ClaudeBot`/etc. The test was never
updated to reflect the intentional policy change.

**Scope:** None of the 05-13..05-21 gap-closure plans touch `public/robots.txt` or
`tests/unit/seo-surfaces.test.mjs`. This is a pre-existing failure on `feature/phase-05`,
unrelated to REND-07/08/09/10/11/12, ARCH-01, or ARCH-08 — out of scope for this plan's Rule
1-3 auto-fix per the execute-plan scope boundary.

**Disposition:** Not fixed here. Whoever owns the robots.txt/Perplexity change should update
`tests/fixtures/v1-robots.txt` (or the test's bot-disallow list) to match the new intentional
policy, or revert the policy if it was unintentional.

**Resolved 2026-10-02 ~20:10 MDT** (owner of the change fixed it): `tests/fixtures/v1-robots.txt`
received the same PerplexityBot/Perplexity-User move as `public/robots.txt`, and
`tests/unit/seo-surfaces.test.mjs` now asserts both bots are *allowed* (PerplexityBot removed
from the disallow loop), with a header note recording the owner decision. `seo-surfaces` 5/5,
`pnpm run test:fast` 738/738.
