# credential-storage

## Goal

Provider API keys leave plaintext `settings.json` and live in OS-backed
credential storage (Electron `safeStorage`, DPAPI on Windows) per
THREE-REPOSITORY-ARCHITECTURE §6; the uninstaller documents the drive-root
data-root residue instead of silently keeping plaintext secrets around.

## Background (2026-10-13 recon, verified)

- Keys live at `settings.providers.<id>.apiKey` (runtime_config.cjs:41-46,
  plaintext default present), written via IPC `settings:write-agent-provider`
  (main.ts:507) / deleted via `:526`; the key NEVER crosses IPC to the
  renderer (`settings:read-agent-providers` returns `configured` bool +
  fingerprint, main.ts:475-499) and is only used in main-process LLM calls
  (provider-registry.ts:94-96 "the one place the apiKey ever lives in
  memory"; model-catalog-refresher.ts:371-379,530-538).
- Electron `^37.3.1`; `safeStorage` never used anywhere yet; needs
  `app.whenReady()` (main.ts:2000). `startupSettings` loads at module top
  level BEFORE ready (main.ts:128) — but key consumption is lazy (resolve on
  session start / catalog refresh), so migration can run post-ready.
- Windows-only release surface (electron-builder nsis only) — safeStorage
  Linux caveat out of scope.
- Uninstall: `deleteAppDataOnUninstall: true` covers only %APPDATA%;
  `installer.nsh` uninstall section does not touch drive-root
  `<drive>:\TDEaseNexus-Data` (fallback at runtime_config.cjs:126-145) —
  plaintext secrets survive uninstall today.
- Plaintext sources to close: user-entered keys (IPC write), settings seed
  (main.ts:83-89 `settings.seed.json` prefill). Built-in esbuild-inlined
  keys (builtin-provider-keys.ts) never touch disk — out of scope.

## Requirements

1. New `electron/credential-store.ts`: `safeStorage.encryptString` /
   `decryptString` over a per-provider map persisted as
   `<settings dir>/credentials.json` (`{ providers: { <id>: <base64 blob> } }`,
   same data root as settings.json so existing install/uninstall lifecycle
   applies). `isAvailable() === false` → **fail-closed**: writes refused,
   reads return not-configured, NO plaintext fallback ever.
2. settings.json stops holding keys: write/delete IPC routes through the
   credential store; on successful store, plaintext `apiKey`/`api_key`
   fields are REMOVED from settings.json (marker
   `providers.<id>.apiKeyStored: true` remains for UI). Same for the seed
   path (main.ts:83-89).
3. Lazy migration on read: `provider-registry.resolve()` (and catalog
   refresher) obtain keys via credential-store; first access after ready
   migrates any legacy plaintext key (read → store → strip from
   settings.json) transparently.
4. Uninstaller residue NOTE (non-destructive): `installer.nsh` uninstall
   section shows a message naming `<drive>:\TDEaseNexus-Data` as possibly
   remaining and how to remove it. Do NOT delete user data from the
   uninstaller.
5. `docs/design/THREE-REPOSITORY-ARCHITECTURE.md` §6 statement about keys
   becomes true (OS credential storage) — align the wording.
6. `docs/STATUS.md` open item closed (main session applies centrally).

## Acceptance Criteria

- [ ] New credential-store unit tests (mock safeStorage): roundtrip,
      isAvailable=false refuses write + reads not-configured, migration
      strips plaintext from settings.json.
- [ ] Existing provider/atomic-write tests stay green; IPC contract
      (`configured` + fingerprint) unchanged.
- [ ] `settings.json` produced by a migrate+write cycle contains no
      `apiKey`/`api_key` values (asserted by test).
- [ ] Full `pnpm -C TDEase-FrontEnd test:run` green; lint clean;
      `pnpm -C TDEase-FrontEnd build` typecheck passes.
- [ ] Footprint: `electron/credential-store.ts`(+test), `electron/main.ts`
      (IPC wiring + seed), `electron/runtime_config.cjs` (if read paths
      need the marker), `src/.../provider-registry.ts`,
      `src/.../model-catalog-refresher.ts` (decrypt at use),
      `electron/installer.nsh`, `docs/design/THREE-REPOSITORY-ARCHITECTURE.md`.
      NOT: STATUS.md, backend, builtin-provider-keys.ts.
