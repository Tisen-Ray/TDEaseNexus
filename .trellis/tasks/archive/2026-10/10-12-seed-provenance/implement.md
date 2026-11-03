# implement — seed-provenance

Ordered checklist. Validation commands are repo-root-relative.

## 1. Read before writing

- [ ] `scripts/release/build-desktop.ps1` (Phase 0.6 block + log-line format)
- [ ] `electron/node_catalog_seed.cjs` + `.test.cjs` (current contract + the
      five existing tests)
- [ ] `electron/main.ts` `provisionNodeCatalogSeed` (unchanged; keep
      `requiredEntries` semantics in mind)
- [ ] `.gitignore` L8-45 (what the definition layer tracks)
- [ ] `data/backend/nodes/` live contents (manifest must cover reality)

## 2. Repo-side manifest + pack script

- [ ] Write `scripts/release/node-seed.manifest.json` exactly per design §1
      (entry set = live dir minus `localOnly`; verify with
      `ls data/backend/nodes`).
- [ ] Write `scripts/release/pack-node-seed.ps1` per design §2
      (param block, manifest read, required-file check, residue check,
      System32 bsdtar explicit include list, size log).
- [ ] Rewrite `build-desktop.ps1` Phase 0.6 to invoke the pack script; keep
      the `node seed zip: ...` log line format; delete the inline exclude tar.

Validate (PowerShell must be runnable on this machine):

```powershell
powershell -NoProfile -File scripts/release/pack-node-seed.ps1 -RepoRoot . -OutZip .tmp/seed-packing-check.zip   # expect: success, 7 entries
# plant residue, expect named failure:
mkdir data/backend/nodes/residue-probe; echo x > data/backend/nodes/residue-probe/f.txt
powershell -NoProfile -File scripts/release/pack-node-seed.ps1 -RepoRoot . -OutZip .tmp/seed-packing-check.zip   # expect: FAIL naming residue-probe
rm -r data/backend/nodes/residue-probe
tar -tf .tmp/seed-packing-check.zip   # expect: nodes/<7 entries> only, no .snapshots
```

## 3. Reseed v2 (electron/node_catalog_seed.cjs)

- [ ] Recursive digest helper (sorted rel paths, `path + "\0" + bytes`).
- [ ] `readManifest`: accept v1 (migrate in memory per design §3) + v2;
      reject ≥3 as corrupt (today's fallthrough).
- [ ] Install loop per design §4 classification table; skip paths warn
      `nodes.seed-skip-modified` / keep existing `nodes.seed-skip-user-owned`.
- [ ] `writeManifest` emits v2 (packages + aux with digests); skipped aux
      entries record nothing.
- [ ] Header comment rewritten to describe the class-based ownership.

## 4. Tests (electron/node_catalog_seed.test.cjs)

- [ ] Existing five tests keep passing under v2 writes (manifest assertions
      updated: packages exclude aux; aux digests present).
- [ ] New: first seed records aux digests.
- [ ] New: unmodified `_template` (bytes unchanged) is replaced on
      fingerprint change.
- [ ] New: user-modified `_template` is skipped + warned, content intact.
- [ ] New: v1 manifest (aux recorded as owned) migrates — aux skipped on
      next update, packages still owned, no wipe.

Validate:

```bash
node --test TDEase-FrontEnd/electron/node_catalog_seed.test.cjs
```

## 5. Docs

- [ ] STATUS.md §Open items: close both seed entries (record the decision:
      manifest-pinned ship set + class-based digest-guarded ownership).

## 6. Full gates (last iteration)

```bash
node --test TDEase-FrontEnd/electron/node_catalog_seed.test.cjs
pnpm -C TDEase-FrontEnd lint
pnpm -C TDEase-FrontEnd test:run
```

## Rollback points

- After step 2 or step 3 independently revertible; single commit at the end.
- `data/` untouched throughout except the transient `residue-probe` probe
  (deleted immediately) and `.tmp/` artifacts (git-ignored).
