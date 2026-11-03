# design — version-handshake

## Backend (submodule tdease-backend, own commit)

- New `app/version.py`: `__version__ = "0.2.0"` (synced with
  pyproject.toml; a test asserts equality so they cannot drift). Existing
  hardcoded copies at `app/main.py:100` (FastAPI metadata) and `:202`
  (`/` route) reference it.
- `/ready` response gains `"version": __version__`. Order/other fields
  unchanged; a degraded engine still reports its version (503 branch
  untouched).
- Tests: `tests/test_serve_e2e.py` asserts the `/ready` body carries the
  version equal to pyproject's; keep existing 200 assertions.

## Desktop

- `client-contracts.ts`: ready snapshot type gains `version: string`
  (optional in the parsed shape; absence is itself a verdict).
- `backendConnection.ts`: after the existing `SUPPORTED_PROTOCOL_VERSION`
  check, evaluate `version` against
  `SUPPORTED_BACKEND_VERSION_RANGE = ">=0.2.0 <0.3.0"` (a plain semver
  range evaluated by a small local comparator — no new dependency; 0.x
  major means minor is the breaking axis). Verdicts:
  - in range → phase `online`, snapshot gains `backendVersion`;
  - out of range → phase `incompatible`, error message
    `Desktop 0.11.0-beta requires Backend >=0.2.0 <0.3.0, found 0.3.1`;
  - missing/empty → `incompatible`, `... found <no version (backend too
    old to report)>`.
- Desktop's own version read from `app.getVersion()` (packaged) — no new
  constants to drift.
- UI: existing `incompatible` phase plumbing renders it (StatusBar key
  exists; GeneralSettings `backendError` shows the message). If the message
  needs no new locale keys, add none.
- Why a range string instead of reusing `protocol_version`: the audit wants
  the failure to NAME the skew in user terms; an integer protocol can't
  express "found 0.3.1". Protocol check stays as the machine gate; version
  is the human-facing compatibility gate. Both fail closed at connect,
  before any Run.

## Compat matrix (accepted)

| desktop \ backend | <0.2.0 / no field | 0.2.x | ≥0.3.0 |
|---|---|---|---|
| new (this change) | fail-closed incompatible | online | fail-closed incompatible |

Old desktop + new backend: unaffected (old desktop ignores the field).
Backend 0.2.1 patch release can bump the range only with a desktop
release — documented in the range constant comment.

## Rollback

Backend: submodule revert + pointer. Desktop: revert; the range constant is
the single knob.
