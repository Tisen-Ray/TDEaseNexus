# design — bootstrap-secret-channel

## Channel

Desktop: `stdio: ["pipe","pipe","pipe"]`; immediately after spawn:
`child.stdin.write(secret + "\n"); child.stdin.end()` (single fire-and-
forget with `.on("error")` swallow — old backends never read stdin and the
pipe close must not surface as an unhandled error). The secret no longer
appears in `env` (`_runtimeEnv` drops it).

Backend (`backend_settings.py`, in the CLI process before uvicorn):
resolution order becomes

1. **stdin first line** (blocking read; EOF → skip). stdin is idle on the
   serve path and the desktop writes immediately, so no timeout is needed:
   a peer that will never write is a peer whose stdin is closed/ignored →
   instant EOF.
2. **env fallback** `TDEASE_BOOTSTRAP_SECRET` (existing path, still gated by
   `--allow-env-overrides`) — keeps a previous-generation desktop working
   for one release.
3. **None** → existing fail-closed `AUTH_BOOTSTRAP_UNAVAILABLE` posture.

## Compat matrix (accepted one-version skew)

| desktop \ backend | env-only (old) | stdin+env-fallback (new) |
|---|---|---|
| env-inject (old) | works (today) | works via env fallback |
| stdin-write (new) | **fails closed** (`AUTH_BOOTSTRAP_UNAVAILABLE` at bootstrap — honest, diagnosable) | works (secret never in any env block) |

The old→new desktop + old backend case failing closed is the accepted
direction (the audit's threat is env transit; no silent downgrade).

## Where the secret lives after read

Unchanged flow: `configure_backend` stores it in-process; `DesktopAuth`
exchanges it once for `{access_token, agent_token}` and clears it
(`app/auth.py:97-159`). No worker-subprocess changes (single-process serve;
workers would re-exec without the secret — verify the serve path doesn't
use workers, and if `cli.py:55-56` worker plumbing exists, assert the
secret never needs to cross it).

## Diagnostics

Desktop logs the channel decision in the crash log
(`nodes`-style key, e.g. `backend.secret-channel=stdin|env|none`) so a
field skew is diagnosable from a single log line.

## Tests

- Desktop `backend_manager.test.cjs`: existing fake-python harness asserts
  (a) spawn env lacks `TDEASE_BOOTSTRAP_SECRET`, (b) the child's stdin
  received `<secret>\n` then EOF.
- Backend: unit test for the resolver (stdin line / EOF→env / neither→None)
  by monkeypatching `sys.stdin`; `DesktopAuth.exchange` single-use +
  token-scope test (owner vs agent scopes).

## Rollback

Desktop: revert (env injection restored). Backend: revert; env fallback
already keeps both generations interoperable during rollout.
