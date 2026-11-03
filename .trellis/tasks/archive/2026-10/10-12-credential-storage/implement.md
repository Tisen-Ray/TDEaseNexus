# implement — credential-storage

1. Read: `electron/runtime_config.cjs` (settings paths + DEFAULTS),
   `electron/atomic-write.ts`, `electron/main.ts:75-149,475-536,2000`,
   `electron/agent/provider-registry.ts`, `electron/agent/
   model-catalog-refresher.ts:360-390,520-545`, `electron/installer.nsh`,
   `electron/agent/provider-registry.test.ts`.
2. Write `electron/credential-store.ts` + `credential-store.test.ts`
   (mock safeStorage; the electron module import must be mockable the way
   sibling electron/*.test.ts do it — follow an existing pattern).
3. Wire IPC write/delete through the store; strip plaintext + set marker.
4. Wire provider-registry + catalog-refresher to the store with legacy
   migration on first access.
5. Seed path through the store (main.ts:83-89).
6. installer.nsh uninstall MessageBox note.
7. THREE-REPOSITORY-ARCHITECTURE.md §6: align wording (keys now OS-backed).
8. Tests green (targeted), then report. Full gates run centrally.

Validation (repo root):
```
pnpm -C TDEase-FrontEnd exec vitest run electron/credential-store.test.ts electron/agent/provider-registry.test.ts electron/atomic-write.test.ts
```

Rollback: `git checkout -- electron/ docs/design/THREE-REPOSITORY-ARCHITECTURE.md`
+ delete new files.
