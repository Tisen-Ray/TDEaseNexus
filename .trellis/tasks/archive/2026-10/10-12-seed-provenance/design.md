# design — seed-provenance

## Contracts

### 1. Repo-side seed manifest (the ship-set authority)

`scripts/release/node-seed.manifest.json`, committed:

```json
{
  "schemaVersion": 1,
  "entries": [
    { "name": "README.md", "kind": "aux" },
    { "name": "_template", "kind": "template" },
    { "name": "informed-proteomics", "kind": "package", "required": ["rules.smk", "README.md"] },
    { "name": "msconvert", "kind": "package", "required": ["rules.smk", "README.md"] },
    { "name": "pride", "kind": "package", "required": ["rules.smk", "README.md"] },
    { "name": "topindex", "kind": "package", "required": ["rules.smk", "README.md"] },
    { "name": "toppic", "kind": "package", "required": ["rules.smk", "README.md"] }
  ],
  "localOnly": [".snapshots", "toppic-windows-1.8.1.zip"]
}
```

- `entries` = the exact ship set. Nothing else inside `data/backend/nodes`
  may enter the zip.
- `localOnly` = entries that may legitimately exist in the live catalog but
  never ship (run snapshots, vendor archives).
- `required` = definition-layer files whose absence means the deployment is
  broken → build fails. Binary bulk is NOT enumerated (vendor bytes come
  from the local deployment; the manifest pins the set, not the bytes).

### 2. Pack script (new, testable)

`scripts/release/pack-node-seed.ps1` with parameters
`-RepoRoot`, `-NodesDir` (default `<repoRoot>/data/backend/nodes`),
`-OutZip`. Behavior:

1. Read the manifest; hard-fail on any listed-but-missing entry or missing
   `required` file.
2. List `Get-ChildItem -Name` of `-NodesDir`; hard-fail naming any top-level
   entry that is neither in `entries` nor in `localOnly` (residue check —
   this is the invariant "ship set ⊆ manifest").
3. Pack with `$env:SystemRoot\System32\tar.exe -a -cf <OutZip> -C
   <nodesDir's parent> <nodes dir name>/<entry>` — explicit include list;
   System32 bsdtar explicitly (Git-Bash GNU tar misreads `-f C:\...`).
4. Print the packed entry names + zip size for the build log.

`build-desktop.ps1` Phase 0.6 shrinks to: prerequisite sanity + invoke the
pack script + keep the size log line. The old inline exclude-list tar is
deleted.

### 3. Reseed manifest v2 (user machine)

`.seed-manifest.json` upgrades to:

```json
{
  "schemaVersion": 2,
  "fingerprint": "<sha256 of nodes.zip>",
  "packages": ["msconvert", "pride", "topindex", "toppic", "informed-proteomics"],
  "aux": [
    { "name": "README.md", "digest": "<recursive sha256 hex>" },
    { "name": "_template", "digest": "<recursive sha256 hex>" }
  ]
}
```

- **Package class**: directory containing `rules.smk`, name not starting
  with `_`. Fully owned — replaced on fingerprint change (unchanged rule).
- **Aux class**: `README.md`, `_template` (anything shipped that is not a
  package). Digest-guarded: recursive SHA-256 over sorted relative paths,
  hashing `path + "\0" + file bytes`. On reseed: current digest equals the
  recorded one → replace with the new version and record the new digest;
  differs, or no recorded digest → SKIP (warn `nodes.seed-skip-modified`),
  record the new... no — record NOTHING for a skipped entry (the user's
  content is the new baseline; the next seed compares against theirs? No:
  against nothing = skip forever until they delete it). Decision: on skip,
  write no aux record → the entry stays "unknown-provenance" and is skipped
  on every later update. Removing their customization by hand restores
  upstream flow. This is the conservative choice; document it in the
  manifest-reading code comment.
- **v1 → v2 migration**: v1 manifest has all shipped names in `packages`
  and no `aux`. On read: keep only entries that satisfy the package class
  in `packages`; every other previously-owned name becomes an aux entry
  with NO digest → digest-guard skips it this update (safe: never wipes),
  and — per the skip rule above — records nothing, so it stays user-owned
  from then on.
- **First seed** (no manifest): install everything fresh; record packages
  + aux digests (all pristine → digest-guard owns them normally).

### 4. reseedNodeCatalog signature/flow changes

Same signature and flow skeleton; only the install loop classifies entries:

```
for each shipped entry:
  if package-class                      → owned: replace
  else if manifest.records aux digest
       && currentDigest(entry) == recorded → owned: replace + update digest
  else if previouslyOwned-by-name-only (v1 names, non-package)
       or aux with no/!matching digest  → skip + warn
  else (user-installed)                 → skip + warn (existing)
```

`writeManifest` writes v2. `readManifest` accepts v1 (migrates in memory)
and v2; schemaVersion ≥3 → treat as corrupt (full reseed) — same as today's
corrupt handling. Shipped-set parity loop (retired packages removed) runs
over `packages` only — retired aux entries are simply not recorded anymore,
their files stay (harmless, user-space).

`main.ts` call site unchanged (same signature, `requiredEntries` contract
intact).

## Tradeoffs

- **Digest-guard vs install-once for aux**: install-once is simpler but
  upstream `_template`/README fixes never reach users; digest-guard costs
  one recursive hash over two small entries per update and preserves both
  directions (upstream flow when untouched, user edits when touched).
- **Skip-forever after first modification** vs re-prompting: no UI surface
  exists for seed conflicts; the warn log + doctor surface is the honest
  channel. Documented in code comment.
- **New ps1 vs inline block**: the residue check must be verifiable without
  a full installer build (which compiles CPython, fetches vendor git…). A
  parameterized script makes both paths runnable in seconds; inline would
  be untestable. One-purpose file, no shared state.

## Rollout / rollback

- Single commit; revert = single revert. Dev machines keep using the repo
  catalog directly (`isDev` guard bypasses reseed), so no migration risk in
  development. Existing end-user installs take the v1→v2 in-memory
  migration on first update boot — no disk-format change beyond the
  manifest file itself.
- Failure mode if the pack script is wrong: the build fails loudly (missing
  entry / residue / tar exit), never ships a wrong-but-plausible zip,
  because the include list IS the manifest.
