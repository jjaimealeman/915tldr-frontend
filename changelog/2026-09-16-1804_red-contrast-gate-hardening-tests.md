# 2026-09-16 - RED: Failing Suite and Fixtures for the Hardened D-13 Contrast Gate

**Keywords:** [TESTING] [STYLING] [ACCESSIBILITY] [BUG_FIX]
**Session:** Evening, Duration (~25 min, continuation after a rate-limit interruption)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-16-1804_red-contrast-gate-hardening-tests.md`

## What Changed

- File: `design/tests/unit/check-contrast.test.mjs` (NEW)
  - `node:test` suite with 17 tests, one per behavior bullet in 01-05-PLAN.md's context
    block: manifest/coverage, gamut, distinctness, D-02 structure, C-01 guards (fail + warn),
    literal-outside-tokens scan, dark-theme inheritance, and two `culori`-cross-checked `toSrgb`
    lib tests
  - `run()`/`runCss()` helpers spawn the real CLI (`design/scripts/check-contrast.mjs`) against
    a fixture or an in-memory CSS variant and assert on exit code, stdout, and stderr — exercises
    the actual script, not an internal function
- File: `design/tests/unit/fixtures/*.css` (13 NEW)
  - `valid.css` copies the real `tokens:start/end` region verbatim plus an empty fonts region
  - Each failing fixture is `valid.css` with exactly the single change its behavior bullet
    names (missing token, unresolved var, out-of-gamut chroma, uncovered colour, hue collision,
    a 9th category, swapped category order, a stop-literal mismatch, a warm-hued neutral, a
    low-contrast neutral, an omitted dark override, a colour literal outside the tokens region)
- File: `package.json`
  - Added `"test:unit": "node --test \"design/tests/unit/**/*.test.mjs\""`
- File: `design/scripts/check-contrast.mjs`
  - Fixed a pre-existing bug in `parseArgs`: it only recognised the equals-form (`--css=path`),
    not the space-separated form (`--css path`) that 01-CONTEXT.md's documented CLI interface
    and this plan's own test harness both use. Every fixture-based test was silently falling
    back to the real `design/mockups/style.css` and the default `--out` path, so the whole
    suite failed for the wrong reason (a broken flag, not missing gate logic) rather than the
    right one. Now accepts both `--flag value` and `--flag=value`.

## Why

TDD RED for 01-05 (harden the D-13 contrast gate). The suite has to fail for the *right*
reasons — because the hardened rules (required manifest, coverage, distinctness, D-02
structure, C-01 guards, literal scan, `--json`) don't exist yet — not because of an unrelated
CLI bug. Discovering and fixing the `--css`/`--out` argument-parsing bug first was necessary to
get a meaningful RED signal at all: before the fix, every single fixture test (including the
ones the gate should already pass, like `valid.css`) failed identically because the script was
silently reading the real stylesheet instead of the fixture.

## Issues Encountered

- **`parseArgs` only supported `--css=value`, not `--css value`.** Found when every fixture
  test failed with the same generic symptom (evidence written to the default path, not the
  test's temp file) instead of the specific per-rule failures the plan's behavior list predicts.
  Root-caused by manually invoking the script with `--css <fixture> --out <tmp>` (the exact
  args the test harness uses) and observing it silently fall back to
  `design/mockups/style.css`. Fixed inline (Rule 1/3 auto-fix — a blocking, pre-existing bug
  in a file this plan already modifies) rather than deferred, since without it RED carries no
  diagnostic information.
- No other issues; confirmed via manual `node design/scripts/check-contrast.mjs --css <fixture>`
  runs against `missing-token.css`, `out-of-gamut.css`, `low-contrast.css`, and
  `dark-inherit.css` that each now exits 1 for a real, rule-specific reason (an unhandled
  `TypeError` on an undefined token, an unnamed gamut error, a threshold failure with no
  stderr line, etc.) rather than a masked default-path fallback.

## Dependencies

No dependencies added. Suite uses Node's built-in `node:test`/`node:assert/strict` and the
already-installed `culori`.

## Testing Notes

- What was tested: `npm run test:unit` — exits 1 (non-zero, confirmed RED). 15 of 17 tests
  fail for legitimate rule-hardening gaps (missing manifest/coverage/distinctness/order/D-02/
  C-01/literal-scan/`--json` logic, or unhandled crashes instead of named-token error
  messages); 2 pass because the pre-existing tracer already resolves `var()` correctly and
  already exits 0 on the untouched real stylesheet.
- What wasn't tested: Task 2's actual gate implementation — that's the GREEN phase, not yet
  written.
- Edge cases: the "C-01 review warning, still exits 0" test (business hue forced to 85°)
  currently fails on gamut-clamping at that hue with the fixture's existing chroma, which Task
  2 will need to account for when implementing the C-01 review path.

## Next Steps

- [ ] Task 2 (GREEN): implement every row of the rule table in `check-contrast.mjs` /
      `css-tokens.mjs` (required manifest with `TokenError`, coverage, distinctness, D-02
      structure, C-01 fail + review, literal-outside-tokens scan, `--json`) until
      `npm run test:unit` is green
- [ ] Run `npm run check:contrast` on the real stylesheet and fix any real gap it surfaces
      (documented hue offset or coverage fix, not a relaxed rule)

---

**Branch:** feature/phase-01
**Issue:** N/A
**Impact:** LOW - test-only changes plus one CLI arg-parsing bug fix; no gate behavior changes
yet (GREEN phase implements the actual hardening)
