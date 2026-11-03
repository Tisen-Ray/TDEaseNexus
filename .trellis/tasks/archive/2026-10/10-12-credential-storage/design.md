# design — credential-storage

## Storage shape

`<same dir as settings.json>/credentials.json`:

```json
{ "schemaVersion": 1, "providers": { "<providerId>": "<safeStorage base64>" } }
```

- Same data root as settings.json → inherits install/uninstall lifecycle
  (drive-root fallback included) with zero new path policy. Plaintext no
  longer rides in settings.json; the blob is DPAPI-bound to the Windows
  user, so a copied file is useless off-machine.
- `schemaVersion` for future re-encryption migrations.

## Module: electron/credential-store.ts

- `isAvailable()` → `safeStorage.isAvailable()`.
- `storeProviderKey(id, plain)` / `deleteProviderKey(id)` /
  `getProviderKey(id)` / `fingerprint(id)` (existing sha256[:8] contract).
- fail-closed: `!isAvailable()` → store/delete throw
  (IPC maps to a settings error), reads return null ("not configured").
  NO plaintext write-back path exists — that is the audit's point.
- All calls require `app.whenReady()` (safeStorage precondition); callers
  are post-ready by construction (IPC + lazy resolve); the module asserts.

## Wiring

- IPC `settings:write-agent-provider` / `settings:delete-agent-provider`
  (main.ts:507/526): route the key through credential-store; on success
  strip `apiKey`/`api_key` from the settings payload before it persists and
  set `providers.<id>.apiKeyStored: true`. Read IPC untouched (already
  key-free).
- `provider-registry.resolve()` (provider-registry.ts:94-96): obtain the
  key via credential-store (lazy, post-ready). Legacy migration on first
  access: settings.json still has plaintext `apiKey` → store encrypted →
  rewrite settings.json without it (atomic-write path, same as today's
  update flow).
- `model-catalog-refresher.ts:371-379,530-538`: same accessor.
- Seed (main.ts:83-89): seed key goes through credential-store; the seeded
  settings.json carries only the marker.
- Renderer contract unchanged: `configured` bool + fingerprint (main.ts:498).

## Uninstaller residue note

`installer.nsh` uninstall section: after the existing uninstall steps, a
MessageBox naming `<drive>:\TDEaseNexus-Data` as a possible leftover data
root (now holding only encrypted blobs + workspace data) and that removing
it is the user's call. Non-destructive by design — we do not delete user
data from an uninstaller.

## Tests

- `credential-store.test.ts` (vitest, mock `safeStorage`): roundtrip;
  isAvailable=false → write throws + read null; fingerprint stable;
  migration strips plaintext (atomic-write on a temp settings file).
- `provider-registry.test.ts`: resolve via store (mock), legacy plaintext
  migration trigger.
- Existing IPC-level behavior covered by atomic-write/provider tests staying
  green.

## Tradeoff recorded

safeStorage is OS-keyed (DPAPI), not user-secret-keyed: any process running
as the same user can decrypt. That is the OS-credential-storage bar
THREE-REPOSITORY §6 sets (protection class rises from "any reader of the
file" to "same-user processes only") and matches the bootstrap-secret
threat model; a stronger vault is out of scope.

## Rollback

Revert; credentials.json is additive (ignored by old code), and a rollback
with existing encrypted blobs degrades to "providers unconfigured" —
fail-closed, re-enter keys.
