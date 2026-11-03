# implement — orchestrate-isolation

1. Read: `electron/agent/workflow-runtime.ts` (whole), `electron/agent/
   ptc-runtime.ts:260-345`, `electron/agent/workflow-runtime.test.ts`,
   `docs/design/ORCHESTRATE-RUNTIME.md`, `docs/design/PTC-RUNTIME.md` (D7).
2. Build the realm in `workflow-runtime.ts`: sandbox + self-deleting
   bootstrap (bridges + JSON snapshots) + `runInContext` async IIFE +
   defensive error read. Replace the AsyncFunction path entirely; keep
   journal/settle/maxAgents/AbortController host-side.
3. Rewrite head comment (realm contract, no-timeout rationale, threat:
   credential reach via process.env).
4. Tests in `workflow-runtime.test.ts` (existing cases must pass unmodified):
   - `typeof process === 'undefined'` and `typeof require === 'undefined'`
     inside the script;
   - escape attempt `({}).constructor.constructor('return process')()`
     throws/undefined inside realm (assert host not reached);
   - all eight names usable (script returns args/cwd echoes);
   - cross-realm thrown Error message survives to the host failure;
   - `log()` still mirrors to host console capture.
5. Docs: ORCHESTRATE-RUNTIME.md decision rewrite.
6. Gates (main session runs full suite; you run targeted):
   `pnpm -C TDEase-FrontEnd exec vitest run src/../electron/agent/workflow-runtime.test.ts`
   via repo-root: `pnpm -C TDEase-FrontEnd exec vitest run electron/agent/workflow-runtime.test.ts`
   and `pnpm -C TDEase-FrontEnd exec vue-tsc --noEmit` typecheck if quick.

Validation commands (repo root):
```
pnpm -C TDEase-FrontEnd exec vitest run electron/agent/workflow-runtime.test.ts
```

Rollback: `git checkout -- TDEase-FrontEnd/electron/agent/workflow-runtime.ts docs/design/ORCHESTRATE-RUNTIME.md`.
