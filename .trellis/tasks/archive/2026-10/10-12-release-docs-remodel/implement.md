# Implementation plan — release docs remodel + flaw remediation

Source: 2026-10-12 four-way audit (backend spec / agent contract / frontend
& engine docs / cross-module design flaws). Full findings live in the audit
record; STATUS.md §Open items carries the live gap list.

## Done in this task

- CAPABILITIES.md ×3 staleness fixes; WORKFLOW-RUN.md parse-time named
  failure contract; AGENT-CONTRACT.md mindset default = executor.
- FRONTEND-INTERACTION-MAP.md aligned to 0.11 tree (nine tabs, side chat,
  TaskTreeCard, fold-items/ContentBlockView walk, export media embedding,
  resizable rail); STUDIO doc 12→13 families.
- 4 engine design HTMLs: config["nodes"] absolute injection model, no
  immutable-snapshot claim, pid:create_time identity, orphan-poller guard.
- STATUS.md: version axis 0.11.0-beta, baselines re-measured (vitest 1555/1558
  green with 3 red settings tests recorded; backend 333 passed / 1 skipped),
  audit flaws opened as items.
- `.trellis/spec/` turned into a pointer layer over the docs system (no
  second authority).

## Phase 1 — release blockers (must land with 0.11)

1. **commit-inflight**: land the uncommitted rules.smk ×4 + backend
   parser→bindings refactor; committed bytes currently contradict
   WORKFLOW-RUN §1 "no Run depends on host PATH".
2. **settings-red-tests**: diagnose + fix the 3 red CommandPalette /
   DocumentHost settings tests (Settings document never opens).
3. **seed-provenance**: node-catalog seed packed from a manifest-listed
   git-tracked source (not `data/backend/nodes`); seed ownership-by-name
   filters `_template/` + non-package entries.

## Phase 2 — high-severity contract/security

4. **orchestrate-isolation**: orchestrate scripts out of the Electron main
   process (worker_thread or node:vm realm à la PTC) with sanitized env;
   credential-denial contract restored.
5. **version-handshake**: version field on Backend `/ready` + Desktop
   compatibility-range check at connect, fail-closed environment error.

## Phase 3 — secrets & residue

6. **credential-storage**: provider keys to OS credential storage (align
   THREE-REPOSITORY §6); uninstaller residue note for drive-root data root.
7. **bootstrap-secret-channel**: pass via inherited handle/stdin, not env.
8. **export-containment**: verify/harden readWorkspaceBlob against
   `.tdease/` runtime-private paths; decide + document the exported-iframe
   `allow-scripts` policy owner.

## Structure debt (tracked, not scheduled)

- `.claude/skills/` vs `.agents/skills/`: 4 skills duplicated with diverged
  content + 2 claude-only. One canonical tree needed.
