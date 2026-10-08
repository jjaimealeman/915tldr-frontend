# 2026-10-08 - Privacy pages stop naming the Umami dashboard host

**Keywords:** [FRONTEND] [I18N] [TESTING] [DOCUMENTATION]
**Session:** Night, Duration (~20 minutes)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-08-0136_privacy-pages-stop-naming-the-umami-host.md`

## What Changed

- File: `src/pages/privacy.astro`, `src/pages/es/privacy.astro`
  - The linked `stats.915websites.com` (anchor, rel/target, new-tab icon) is now plain text: "self-hosted by 915website.com" / "alojada por 915website.com". The docs.umami.is citation is untouched
- File: `tests/unit/privacy-no-analytics-host.test.mjs` (new)
  - Rendered template (frontmatter and HTML comments stripped) must not contain the host in either language; new sentence present; only the docs citation remains as an external link in the Umami paragraph; Base.astro tracker tag unchanged; one built-output check gated on a fresh dist
- File: `docs/phase-06/live-verification.md`, `docs/phase-06/spanish-pages-review.md`
  - Task D note; dated note on the reviewed Spanish sentence (history left as is)

## Why

Owner decision 2026-10-08: the Umami dashboard URL must not be visible text or a link on any public page. The tracker script tag in Base.astro stays as is (owner confirmed).

## Issues Encountered

- The brief said to keep a "Prefer not to be counted?" sentence with an /opt-out link; neither privacy page contains it (the opt-out pages were built unlinked on purpose), so nothing was kept or added.

## Dependencies

No dependencies added

## Testing Notes

- What was tested: `pnpm run test:fast` 1073 tests, 1067 pass, 0 fail, 6 skipped (all dist-fresh gated); build-gate 9 of 9. The new tests were seen red (5 failing) before the edit
- What wasn't tested: the built HTML (no local build allowed); the live pages
- Edge cases: sentence wrapped across source lines is matched after whitespace collapse

## Next Steps

- [ ] After deploy, confirm the host appears only in the tracker tag on /privacy and /es/privacy
- [ ] Decide separately whether the privacy pages should link to /opt-out

---

**Branch:** feature/phase-06-polish
**Issue:** N/A
**Impact:** LOW
