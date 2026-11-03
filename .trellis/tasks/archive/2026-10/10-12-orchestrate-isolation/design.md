# design — orchestrate-isolation

## Contract

Same public behavior as today (`runOrchestrate({script, args, ...})` →
journal run + settle), but the script body executes inside a `node:vm`
realm built like `ptc-runtime.ts:275-314`:

```
sandbox = { __run: bootstrapBridge }        // the ONLY host key
vm.createContext(sandbox)
runInContext(self-deleting bootstrap IIFE)  // defines agent/parallel/
                                            // pipeline/phase/log closures,
                                            // then deletes __run
runInContext('(async () => { <script> })()') // returns host-side Promise
```

- **Bridges (host-side closures, unchanged semantics)**: `agent`, `parallel`,
  `pipeline`, `phase`, `log` — the same functions the AsyncFunction form
  injected, closed over the run context. `console.log` mirroring stays in
  the `log` wrapper (host side).
- **Snapshots (JSON-safe copies)**: `budget`, `args`, `cwd` are
  structured-cloned into the sandbox bootstrap before deletion; scripts
  mutate their copy, host never sees mutations (today's form shared live
  objects — an acceptable, safer change).
- **Cross-realm errors**: read via `errorMessageOf`-style defense
  (name + message only, `String()` fallback) exactly like
  `ptc-runtime.ts:323-325`; never `instanceof Error`.
- **No wall-clock timeout**: orchestrate runs legitimately block awaiting
  sub-agents (minutes+). Isolation scope is credential reach, not DoS.
  maxAgents + AbortController remain the levers; state this in the head
  comment.
- **Not extracted into a shared module**: ptc-runtime's bridge shape
  (tool dispatch) differs from orchestrate's (agent graph); duplicating the
  ~30-line realm bootstrap beats coupling two production runtimes. Each
  file cross-references the other in comments.

## Why not worker_thread

Scripts are pure orchestration over host bridges (no CPU-bound compute);
a worker thread would force an async-RPC bridge for every `agent()` call
and move the journal/settle machinery across threads. `node:vm` gives the
global-scope isolation the audit requires at a fraction of the surface.
Same reasoning PTC recorded (PTC-RUNTIME.md D7).

## Docs

- `docs/design/ORCHESTRATE-RUNTIME.md`: D1 "No vm sandbox" decision and the
  execution-model lines are rewritten to the realm model (decision log
  gains the reversal note referencing this task).
- Module head comment (`workflow-runtime.ts:13-23`): rewrite from "no VM
  sandbox by design" to realm contract + no-timeout rationale.

## Rollback

Single revert; no persisted-format change (journal untouched).
