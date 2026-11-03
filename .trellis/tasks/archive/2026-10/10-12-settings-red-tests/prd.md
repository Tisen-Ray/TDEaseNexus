# settings-red-tests

## Goal

Make the 3 red CommandPalette/DocumentHost settings tests green by aligning
them to the Settings **modal** contract, and resolve the code-vs-doc conflict
the diagnosis exposed (stale spec passages still describing a "settings
document").

## Background (diagnosis, 2026-10-13)

- `9838195` (2026-10-09, `[ux] Settings 改为居中弹窗（Obsidian 姿态）`)
  deliberately moved Settings from a document tab to a centered global modal:
  draggable/splittable tab containers misposition the settings surface's
  nested dialogs (custom-provider popover); an append-to-body fixed modal is
  the only honest host. All entry points (rail, palette per-section entries,
  credential gate, model-picker footer) funnel through
  `documents.openSettings()` → `settingsModalOpen = true` + one-shot
  `requestedSettingsSection`. The `settings` document definition stays
  registered only so already-open legacy tabs keep rendering
  (`documents/definitions.ts`).
- The 3 tests still assert the pre-modal document contract and stayed red
  since that commit (STATUS.md §Open defects, 2026-10-12 entry).
- The 2026-10-13 doc reconciliation (`79b5b2a`) missed this change:
  `docs/design/FRONTEND-INTERACTION-MAP.md` still says "settings document"
  (rail row ~line 48, palette-sections passage ~line 695, §7.7), and
  `docs/STATUS.md` §Frontend repeats "the Settings document".

**Ruling** (per AGENTS.md code-vs-doc rule): the modal implementation is
authoritative; the tests are stale (drift from `9838195`); the spec passages
are stale and must be corrected. The dangling "§3.1" marker in one test title
points at a pruned doc section and is dropped.

## Requirements

1. `CommandPalette.test.ts` "reaches the Settings document…" — rewrite to the
   modal contract: submitting the settings entry asserts
   `documents.settingsModalOpen === true` (not an `openDocuments` tab).
2. `CommandPalette.test.ts` "a section entry focuses…" — assert
   `settingsModalOpen === true` AND `requestedSettingsSection === 'statistics'`
   (the one-shot ref mechanism is unchanged by the modal move).
3. `DocumentHost.test.ts` "dispatches settings to the reused
   components/settings surface" — exercise the **retained** `settings`
   dispatch: place a `kind: 'settings'` document directly on the store via the
   existing `setActiveKey` helper (legacy-tab path), assert the
   SettingsDocument stub renders. This keeps §5.1 dispatch-table coverage for
   the kind that stays registered.
4. Correct the stale spec passages to the modal contract:
   - `docs/design/FRONTEND-INTERACTION-MAP.md`: rail row (~L48), palette
     sections passage (~L695), §7.7 (retitle: Settings opens as the centered
     modal; document definition retained for legacy tabs, no entry point
     opens new ones), and the registered-kinds list (~L646) if it implies a
     reachable settings document.
   - `docs/STATUS.md`: §Open defects settings entry → resolved with the
     ruling; §Frontend "the Settings document" → "the Settings modal".
5. Production source under `src/**` / `electron/**` must NOT change — this is
   test + doc only. If implementation turns out to also need a fix, stop and
   re-scope with the user first.

## Acceptance Criteria

- [ ] `pnpm test:run` (TDEase-FrontEnd): 0 failed — baseline was 1555/1558
      with exactly these 3 red.
- [ ] `git diff --stat` touches only the two test files + the two docs files.
- [ ] FRONTEND-INTERACTION-MAP.md contains no "settings document/tab" claims
      contradicting the modal; §7.7 documents the modal host + retained
      definition rationale.
- [ ] STATUS.md no longer lists the settings tests as an open defect; the
      code-vs-doc ruling is recorded there.
- [ ] No new `design.md`/`implement.md` needed (lightweight, test+doc only).
