# implement — version-handshake

ORDER MATTERS: submodule first, then desktop, then pointer.

1. In `tdease-backend/`: read `app/main.py`, `pyproject.toml`,
   `tests/test_serve_e2e.py`. Create `app/version.py` with the constant;
   rewire `:100`/`:202`; add `version` to `/ready` body.
2. Backend tests: pyproject-equality drift guard + `/ready` carries version.
   Run: `uv run --project tdease-backend pytest tests/test_serve_e2e.py
   tests/test_backend_bind.py -q` (targeted; full suite runs centrally).
3. Submodule commit: `[feat] /ready 携带后端版本字段并收敛版本常量` (style per
   `git -C tdease-backend log --oneline -5`).
4. Desktop: `client-contracts.ts` ready type + `backendConnection.ts` range
   check (after protocol check; snapshot `backendVersion`; both
   incompatible verdicts name both versions). Desktop version via
   `app.getVersion()` — check how supervisor accesses electron app (it may
   need it injected; if supervisor is electron-free, read package.json
   version via the existing app-info path — do NOT import electron into a
   renderer-shared module; pass it in from the electron side or read the
   packaged constant the way other modules do).
5. Frontend tests: three mock-fetch cases (ok / too old / missing).
6. Report: submodule commit hash, files changed, targeted test output.
   Do NOT advance the submodule pointer yourself — the main session does it
   in the task commit.

Validation commands (repo root):
```
uv run --project tdease-backend pytest -q
pnpm -C TDEase-FrontEnd exec vitest run src/services/backend/backendConnection.test.ts
```

Rollback: submodule `git reset --hard ORIG_HEAD`; desktop files
`git checkout --`.
