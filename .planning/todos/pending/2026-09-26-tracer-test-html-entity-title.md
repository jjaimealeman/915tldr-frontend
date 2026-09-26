---
created: 2026-09-26T20:20:00Z
title: Tracer test fails when the newest article title contains an apostrophe
area: testing
severity: minor
files:
  - tests/tracer/tracer.test.mjs
resolves_phase: 4
---

## Problem

`pnpm test:tracer` checks "built HTML carries the live headline" with a literal
`html.includes(row.title)` against the raw D1 value. Astro HTML-escapes the title, so an
apostrophe renders as `&#39;` and the check fails. The tracer always renders the newest article,
so whether this test passes depends on what was ingested last. Found 2026-09-26 during Phase 3
security remediation; it predates that work.

## Fix

Compare against the HTML-escaped title (or decode entities in the built HTML before comparing).
Add a unit case with an apostrophe and an ampersand so it cannot regress. Phase 4 replaces the
single-article tracer with full static generation, so fold this into whatever test succeeds it.
