# bootstrap-secret-channel

## Goal

The backend bootstrap secret reaches the backend via stdin (written once
right after spawn), not via spawn env — same-user sibling processes in the
Job Object tree (MCP/PTY/bash sandbox) can read any process's environment
block today, so env transit leaks the secret before the one-time bootstrap
exchange consumes it.

## Background (2026-10-13 recon, verified)

- Desktop mints the secret per launch (`backend_manager.cjs:81`), injects
  `env.TDEASE_BOOTSTRAP_SECRET` (`:314-315`), spawns with
  `stdio: ["ignore","pipe","pipe"]` (`:350`), then POSTs
  `/api/auth/bootstrap` with header `X-TDEase-Bootstrap` to exchange it for
  `{access_token, agent_token}` (`:113-136`), clearing the secret after.
- Backend reads the env var in `backend_settings.py:162` (gated by
  `--allow-env-overrides`, passed at spawn `:341`); exchange mints owner +
  agent tokens and clears the secret (`app/auth.py:97-159`).
- Job Object is kill-scope only (`windows-job.cjs:76-99`); the leak is
  same-user ReadProcessMemory of the PEB env block — env transit is the
  exposure, not the Job Object.
- Backend CLI owns startup: secret config happens before uvicorn starts
  (`cli.py:65-69 _serve → _configure`); stdin is idle on the serve path
  (ready JSON goes to stdout, `cli.py:135-146`).
- tdease-backend is a git submodule (clean tree; commit style
  `[type] 中文描述`).

## Requirements

1. Desktop: spawn with `stdio: ["pipe","pipe","pipe"]`; immediately write
   `<secret>\n` to `child.stdin` and end it. Handle EPIPE/short-write
   gracefully (old backend never reads stdin — the write must not crash the
   manager). Stop injecting `TDEASE_BOOTSTRAP_SECRET` into the env.
2. Backend: `bootstrap_secret` resolution order becomes
   **stdin first line → env fallback → None**. EOF (old desktop's stdio
   "ignore") or absent line falls through to the env var, so a previous-
   generation desktop keeps working for one release; a NEW desktop with an
   OLD backend fails closed with the existing `AUTH_BOOTSTRAP_UNAVAILABLE`
   (accepted one-version skew, fail-closed direction).
3. The secret must reach the same in-process auth configuration as today
   (read before uvicorn starts in the CLI process; no worker-subprocess
   changes).
4. Compat marker: desktop logs/records the channel used (crash log) so a
   skew is diagnosable in the field.
5. Tests: desktop `backend_manager.test.cjs` asserts the secret is written
   to stdin and absent from the spawn env; backend tests cover
   stdin-first / env-fallback / none paths and `DesktopAuth.exchange`
   single-use semantics.
6. Submodule `tdease-backend` gets its own commit (stdin channel + tests);
   main-repo commit advances the pointer.
7. `docs/STATUS.md` open item closed (main session applies centrally).

## Acceptance Criteria

- [ ] `node --test TDEase-FrontEnd/electron/backend_manager.test.cjs` green
      including new stdin/env assertions.
- [ ] `uv run --project tdease-backend pytest` green including new channel
      and exchange tests.
- [ ] Full `pnpm -C TDEase-FrontEnd test:run` green; lint clean.
- [ ] Submodule committed + pointer advanced in main-repo task commit.
- [ ] Footprint: `TDEase-FrontEnd/electron/backend_manager.cjs`(+test),
      `tdease-backend/src/backend_settings.py`, `tdease-backend/src/cli.py`,
      `tdease-backend/tests/*`, submodule pointer. NOT: STATUS.md,
      auth.py contract changes, PTY/MCP env plumbing.
