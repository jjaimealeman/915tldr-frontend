# Conventions

## Branching — one branch per phase

Each phase gets its own branch, named for the zero-padded phase number so it matches the
phase directory under `.planning/phases/`:

```
feature/phase-01    Design Sketch & Editorial Identity
feature/phase-02    Content Quality & Grounding
feature/phase-03    Foundation & Read-Budget Guardrails
...
```

**Jaime creates the branch in lazygit.** Claude never runs `git checkout -b`, `git branch`,
`git merge`, `git rebase` or `git push` — those stay manual, per the global rules.

**Planning artifacts may stay on `develop`.** Work under `.planning/` — PROJECT.md,
REQUIREMENTS.md, ROADMAP.md, and per-phase `CONTEXT.md` / `RESEARCH.md` / `PLAN.md` /
`DISCUSSION-LOG.md` — is planning-stage output and does not need a phase branch. Committing
it to `develop` is fine and is the established pattern for this project (confirmed
2026-09-16).

**Implementation work does not.** As soon as a phase produces code — source files, configs,
scripts, mockups, tests — it belongs on that phase's `feature/phase-NN` branch. If the branch
does not exist yet, ask Jaime to create it rather than starting on `develop`.

**Why:** phases are the unit of review here. One branch per phase keeps a phase's diff
reviewable on its own in lazygit, and keeps `develop` free of half-finished implementation
while planning for later phases continues in parallel.
