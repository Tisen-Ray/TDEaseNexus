# Frontend (TDEase-FrontEnd) — engineering spec index

> This tree is a POINTER layer, never a second authority. The project's
> binding contracts live in the main docs system (`docs/README.md` defines
> the authority order). Do not duplicate facts here.

## Authority map

| Concern | Authority |
|---|---|
| Development iron rules | `AGENTS.md` (repo root) |
| Architecture mental model + structure cheat-sheet + commands | `AGENTS.md` (merged cheat-sheet section) |
| Frontend feature description | `docs/design/FRONTEND-INTERACTION-MAP.md` |
| Studio business logic / command seams | `docs/design/STUDIO-FRONTEND-BUSINESS-LOGIC.md` |
| Agent surface & event contracts | `docs/spec/AGENT-CONTRACT.md`, `AGENT-EVENTS.md` |
| What is actually implemented | `docs/STATUS.md` |

Stack: Vue 3 + TypeScript + Pinia + Element Plus, Electron main/agent in
`electron/`. Vue Composition API — there are no React-style "hooks"; shared
stateful logic lives in composables under `src/` and Pinia stores.

## Pre-Development Checklist

1. Read `AGENTS.md` (binding) and the STATUS entry owning your change.
2. `pnpm run lint` + `vue-tsc` clean before handover; vitest for the touched
   area; e2e-first per iron rule 2 (end-to-end tests are the core).

## Quality Check

`pnpm run lint` clean · vue-tsc 0 errors · vitest green (or red recorded in
`docs/STATUS.md` Open defects) · `check:i18n` / `check:reachability` when
touching keys or modules.
