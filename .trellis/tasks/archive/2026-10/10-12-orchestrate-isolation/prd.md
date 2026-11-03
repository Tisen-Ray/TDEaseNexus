# orchestrate-isolation

## Goal

Orchestrate scripts execute inside a `node:vm` realm (PTC's pattern) instead
of the Electron main process global scope, with host bridges only — no
`process`, no credential reach. Restores the credential-denial contract
(AGENT-CONTRACT §5.1: provider/API secrets are forbidden to agent-launched
code).

## Background (2026-10-13 recon, verified)

- `electron/agent/workflow-runtime.ts:167-171` compiles the model-authored
  script with `new AsyncFunction('agent','parallel','pipeline','phase','log',
  'budget','args','cwd', script)` and calls it in the MAIN process scope:
  `process.env` (backend bootstrap secret, provider keys) is readable today.
  Head comment (lines 13-23) documents this as deliberate ("No VM sandbox").
- PTC solved the same problem with `node:vm`: `electron/agent/ptc-runtime.ts:275-314`
  — sandbox with only host bridges, self-deleting bootstrap, JSON-only
  boundary, defensive cross-realm error reads (:323-325).
- Real scripts use only `agent`/`parallel`/`pipeline`/`Promise`/literals
  (workflow-runtime.test.ts samples; policy prompt forbids require/fs/Date).
  No capability gap from isolation.
- Scripts arrive via `tdease.orchestrate.run` (model-authored) — the threat
  model is prompt-injected exfiltration of credentials.

## Requirements

1. Script execution moves into a `vm.createContext` realm whose globals are
   only the eight injected names plus JS intrinsics; `process`/`require`/
   host constructor chains unreachable (PTC's self-deleting bootstrap).
2. Host bridges: `agent`/`parallel`/`pipeline`/`phase`/`log` remain host-side
   closures; `budget`/`args`/`cwd` cross as JSON-safe snapshots (deep copy).
3. Cross-realm errors are read defensively (message + name), never assumed
   to be host `Error` instances.
4. Existing runtime semantics unchanged: journal runId, settle semantics,
   maxAgents budget, AbortController cancellation, `console.log` mirroring
   stays host-side. NO wall-clock timeout is added (runs legitimately await
   sub-agents for long periods) — document that in the head comment.
5. Tests: realm denies `process`/`require`/`process.env`; all eight names
   usable; cross-realm error message readable; every existing test in
   `workflow-runtime.test.ts` passes unchanged.
6. Docs updated where the old decision lives: `docs/design/ORCHESTRATE-RUNTIME.md`
   (D1 "No vm sandbox") and the module head comment.
7. `docs/STATUS.md` open item closed (main session applies this centrally).

## Acceptance Criteria

- [ ] In-realm `typeof process === 'undefined'`; `process.env` unreachable;
      constructor escape (`{}.constructor.constructor`) cannot reach host
      require — asserted by tests.
- [ ] All existing `workflow-runtime.test.ts` tests pass unmodified in
      behavior; new isolation tests added.
- [ ] `pnpm -C TDEase-FrontEnd test:run` full suite green; lint clean.
- [ ] `pnpm -C TDEase-FrontEnd build` (vue-tsc + electron typecheck) passes.
- [ ] Footprint: `electron/agent/workflow-runtime.ts`,
      `electron/agent/workflow-runtime.test.ts`,
      `docs/design/ORCHESTRATE-RUNTIME.md` only. NOT: ptc-runtime.ts,
      STATUS.md (main session owns), prompts submodule.
