# seed-provenance

## Goal

Make the shipped node-catalog seed's **content** a function of the commit, not
of the local `data/` state, and stop update reseeds from wiping user
customization of `_template/` and non-package entries.

## Background (diagnosis, 2026-10-13)

Two STATUS.md §Open items, verified against the code:

1. **Build side** — `scripts/release/build-desktop.ps1` Phase 0.6 packs the
   seed with `tar -a -cf nodes.zip -C data/backend nodes`, excluding only two
   name-based paths (`nodes/.snapshots`, `nodes/toppic-windows-1.8.1.zip`).
   `data/backend/nodes` is simultaneously the live simulated-client catalog:
   anything dev/e2e installs there, any scratch file, any uncommitted edit
   ships in the installer. Same commit → different installers. Violates the
   AGENTS.md iron rule "data/ is never a source of truth".
2. **Seed side** — `electron/node_catalog_seed.cjs` records EVERY shipped
   top-level entry in `.seed-manifest.json` (including `_template/` and
   `README.md`) and owns them by name: a changed zip fingerprint deletes and
   replaces them. `_template/` is the user's copyable starting point and
   README.md the catalog list — user modifications are silently wiped on
   every update that changes the zip.

**Key constraint** (verified in `.gitignore` L8-45): only the definition layer
of `data/backend/nodes` is git-tracked (each package's `rules.smk` +
`README.md` + a few .txt resources; 25 tracked files total). Vendor binaries
(~230 MB) exist only in the local deployment. So "pack from a git-tracked
source" is impossible literally; the achievable contract is a **committed
manifest** that pins the shipped SET, and a build that fails when the live
directory holds entries the manifest does not list.

## Requirements

1. A committed seed manifest (repo) is the single authority for what ships:
   entry names, their kinds, and per-package required files.
2. The build packs ONLY manifest-listed entries (explicit include list, not
   exclude-list) and FAILS when `data/backend/nodes` contains a top-level
   entry that is neither manifest-listed nor declared local-only.
3. The pack logic must be independently runnable (parameterized script
   invoked by build-desktop.ps1), so both the success and the residue-fail
   paths are verifiable without running the full installer build.
4. Reseed ownership becomes class-based, not name-blind:
   - real node packages (directory, contains `rules.smk`, name not `_`-prefixed)
     stay fully owned → replace on fingerprint change;
   - `_template/` and `README.md` become digest-guarded: replaced only when
     their current content still matches what the previous seed installed;
     a user-modified or unknown-provenance entry is skipped with a warning,
     never overwritten;
   - user-installed/renamed packages remain never-touched (existing rule);
   - retired owned packages are still removed (existing rule).
5. Existing user installs whose `.seed-manifest.json` is schemaVersion 1
   (aux entries recorded as owned with no digests) migrate safely: aux
   entries are treated as unknown-provenance → skipped this update and left
   user-owned thereafter (no digest recorded — design §3's conservative
   skip-forever choice; upstream flow resumes only if the user removes
   their customization). No wipe on migration.
6. The reseed contract otherwise holds: fingerprint-match short-circuit,
   crash-mid-reseed idempotent retry, `requiredEntries` shipped-package
   assertion, `main.ts` call site unchanged.
7. STATUS.md: both open items closed with the decision recorded.

## Acceptance Criteria

- [ ] `scripts/release/node-seed.manifest.json` committed, listing exactly
      `README.md`, `_template`, and the five packages (informed-proteomics,
      msconvert, pride, topindex, toppic), with `localOnly` covering
      `.snapshots` and `toppic-windows-1.8.1.zip`.
- [ ] pack script run against the real tree produces a zip whose top-level
      set equals the manifest; run against a tree with a planted residue
      directory FAILS with an error naming the residue.
- [ ] `node --test electron/node_catalog_seed.test.cjs`: the seven
      pre-existing tests still pass (adapted to the v2 manifest), plus new
      tests: v1→v2 migration skip, user-modified `_template` skipped,
      unmodified `_template` replaced, aux digests recorded.
- [ ] Full `pnpm -C TDEase-FrontEnd test:run` green (no renderer surface
      change expected); eslint clean on touched files.
- [ ] STATUS.md §Open items: both seed entries resolved with the ruling.
- [ ] No changes outside: `scripts/release/*`, `electron/node_catalog_seed.*`,
      `docs/STATUS.md`, task artifacts. `main.ts` untouched.
