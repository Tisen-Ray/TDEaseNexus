# version-handshake

## Goal

Backend `/ready` carries its version; Desktop checks a compatibility range
at connect and fails closed with an environment error naming both versions,
instead of opaque mid-Run 404/422 on skew.

## Background (2026-10-13 recon, verified)

- `tdease-backend/app/main.py:223-236` `/ready` returns
  `{status, engine, instance_id, generation, started_at}` — no version.
  Version `0.2.0` is hardcoded twice (`app/main.py:100`, `:202`) while
  `pyproject.toml:4` is authoritative — three copies to converge.
- Desktop `backendConnection.ts` already has a fail-closed incompatible
  precedent: `SUPPORTED_PROTOCOL_VERSION = 3` (:25) → phase `'incompatible'`
  (:137-144), surfaced by StatusBar (`backendIncompatible` locale key) and
  GeneralSettings `backendError`. `/ready` response bytes are read at :147-151.
- Desktop version authority: `TDEase-FrontEnd/package.json` `0.11.0-beta`;
  backend: `tdease-backend/pyproject.toml` `0.2.0`. Repos release
  independently (CHANGELOG convention, Keep a Changelog).
- tdease-backend is a git submodule: backend change is its own commit; main
  repo advances the pointer.

## Requirements

1. Backend: single version constant (module `app/version.py` or
   `app/__init__.py`) used by FastAPI app metadata, `/` route, and a new
   `version` field on `/ready`; a backend test asserts the constant equals
   `pyproject.toml`'s version (drift guard) and that `/ready` carries it.
2. Desktop: `/ready` client contract gains `version: string`. The supervisor
   checks the version against a supported range AFTER the protocol check;
   out-of-range OR MISSING version → phase `'incompatible'` with an error
   message naming both sides (`Desktop <x> requires Backend <range>, found
   <y/none>`). Missing version = too old to handshake = fail closed.
3. Compat range definition (design decision, no product surface added):
   `SUPPORTED_BACKEND_VERSION_RANGE = ">=0.2.0 <0.3.0"` (same minor of 0.x =
   compatible; 0.x minor is the breaking axis). Range bumped per release.
4. Remote AND local paths flow through the same supervisor probe — one
   check covers both. UI already renders `incompatible`; no new locale keys
   required unless the message needs the version parameters.
5. Tests: backend pytest asserts `/ready` version; frontend mock-fetch tests
   cover version-ok / version-too-old / version-missing.
6. `docs/STATUS.md` open item closed (main session applies centrally).

## Acceptance Criteria

- [ ] `uv run --project tdease-backend pytest` green including new version
      assertions; version constant matches pyproject.
- [ ] Frontend `backendConnection.test.ts` has the three new cases and full
      `pnpm -C TDEase-FrontEnd test:run` stays green; lint clean.
- [ ] Submodule `tdease-backend` committed separately, main-repo pointer
      advanced in the same task commit.
- [ ] Footprint: `tdease-backend/app/*`, `tdease-backend/tests/*`,
      `src/services/backend/backendConnection.ts`,
      `src/services/backend/client-contracts.ts`,
      `src/services/backend/backendConnection.test.ts`, submodule pointer.
      NOT: STATUS.md, CHANGELOG.md (main session owns docs closure).
