# AGENTS.md — Bill Impact Analyzer

## Project summary

Personal web tool that turns a California bill into a draft IT workload worksheet for CDSS ISD. Public bill data server-side only; the private staffing rubric stays in the browser and is never uploaded.

## Canonical brief

Read `CLAUDE.md` at the repo root before doing any work. It carries the repo map, the rules (especially: the rubric never enters the repo, a prompt, a log or the server), the current state, and pointers to `docs/`.

## Run and test

- **Install:** `npm ci`
- **Run locally:** `npm run dev`
- **Test:** `npm test` and `npm run build && npm run test:e2e`
- **Build:** `npm run build`

## The one rule every agent follows here

**Jeff approves merges.** At every stop, rewrite the Current State section of CLAUDE.md and append an entry to `docs/HANDOFF-LOG.md`.
