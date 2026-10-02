---
id: SEED-001
status: dormant
planted: 2026-10-02
planted_during: Phase 05 (hybrid-archive-zero-reads-proof), gap closure
trigger_when: planning the first milestone after the v2 public-site cutover, or any milestone touching reader engagement, subscriptions, notifications, or the PWA
scope: large (staged; stage 1 alone is medium)
---

# SEED-001: Personalized news for readers — `/me`, digests, follow-a-story

## Why This Matters

Owner idea (2026-10-02, during the Cloudflare Birthday Week review): let readers see only
what they care about — pick categories/sources, follow a specific story — and get it as
their own page and/or a digest. 915 TLDR has already shipped simple PWAs, so the delivery
surface is familiar.

The hard constraint is the rebuild's core value: **zero D1 reads on the public request
path.** A server-rendered personalized homepage would turn every view into a database read —
the exact cost v2 removes. Every stage below is shaped to avoid that.

## The idea, staged

1. **No-account personalization (do first).** `/me` is a prerendered static shell —
   byte-identical for every visitor, zero D1 — with a Vue island that reads
   category/source/topic preferences from `localStorage` and filters build-time per-category
   JSON on the client. Works offline as a PWA. No login, no personal data held server-side.
   Covers most of "show me only what I care about."
2. **Email digest.** Subscribe is an Astro Action (a write, not a public read). A cron step
   builds each subscriber's digest at site-build time — fits the build-time model.
3. **Follow a story.** The pipeline already clusters the same story across outlets
   (duplicate detection). Following a cluster = web push (PWA) when a new article joins it,
   computed at ingest time, not on page view.
4. **Real accounts — only if 1–3 show demand.** The only thing accounts add is cross-device
   sync of preferences. Costs: auth, privacy-policy update, account deletion, signup abuse
   (Turnstile; Cloudflare Account Abuse Protection requires Bot Management Enterprise).
   If added, `/me` may read prefs from KV or a static/per-user object — never per-request D1.

## When to Surface

**Trigger:** planning the first milestone after the v2 public-site cutover, or any milestone
touching reader engagement, subscriptions, notifications, or the PWA.

## Scope Estimate

Large overall; stage 1 is medium on its own (one static route + one island + build-time
per-category JSON). Stages 2–4 each add infrastructure (email sending, push subscriptions,
auth).

## Breadcrumbs

- `.planning/PROJECT.md` — "Zero D1 reads on the public request path" (core value); subscribe
  form via Astro Actions (stack notes in `.claude/CLAUDE.md` §6).
- Cross-source duplicate clustering lives in the v1 pipeline:
  `915tldr.com2/server/api/cron/detect-duplicates.post.ts`.
- v1 admin auth (better-auth): `915tldr.com2/server/lib/auth.ts`, `server/api/auth/[...all].ts`.

## Notes

Discussed with the owner in-session on 2026-10-02; recommendation was to build stage 1 first
and let usage decide whether accounts are ever worth their cost.
