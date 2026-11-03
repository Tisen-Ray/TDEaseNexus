# implement — bootstrap-secret-channel

ORDER MATTERS: submodule first, then desktop, then pointer (main session).

1. In `tdease-backend/`: read `src/backend_settings.py:140-180`,
   `src/cli.py`, `app/auth.py`. Implement the stdin-first resolver
   (blocking line read; EOF → env fallback; both absent → None). Keep the
   `--allow-env-overrides` gate semantics for the env fallback.
2. Backend tests: resolver paths (monkeypatch stdin/stdout), plus
   `DesktopAuth.exchange` single-use + owner/agent scope assertions.
   Run: `uv run --project tdease-backend pytest -q` (targeted files at
   least: the settings + auth test files).
3. Submodule commit: `[fix] bootstrap secret 改经 stdin 通道，env 回退一版`.
4. Desktop `electron/backend_manager.cjs`: stdio pipe triple, stdin write
   with error swallow, `_runtimeEnv` drops the secret, crash-log channel
   note. Keep `--allow-env-overrides` in args (old-backend compat path).
5. Desktop tests in `backend_manager.test.cjs`: env-absence + stdin-content
   assertions (extend the existing fake-python harness; find how it
   captures stdin in the existing 38 assertions' style).
6. Report: submodule commit hash, changed files, targeted test output.
   Do NOT advance the submodule pointer — main session does it.

Validation (repo root):
```
node --test TDEase-FrontEnd/electron/backend_manager.test.cjs
uv run --project tdease-backend pytest -q
```

Rollback: `git -C tdease-backend reset --hard ORIG_HEAD`;
`git checkout -- TDEase-FrontEnd/electron/backend_manager.cjs`.
