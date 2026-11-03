# export-containment

## Goal

Conversation export (and the render paths that feed it) must not copy
`.tdease` runtime-private workspace content into shareable files, and the
exported iframe sandbox policy gets one owner instead of two drifting
hardcoded strings.

## Background (2026-10-13 recon, verified)

- `readWorkspaceDataUrl` (`agentConversation.ts:113-132`) → main-process
  `workspace:read-bytes` (`main.ts:1354`, `containedPath` stops traversal +
  symlink escape but has NO `.tdease` exclusion) → any workspace file can be
  embedded into the exported HTML at `exports/<stamp>-<slug>.html`.
- Attack shape: an injected/induced transcript image reference like
  `![](.tdease/settings.json)` becomes a `data-workspace-src` embed —
  MCP config, permissions.json, session/audit logs ride into a file the
  user shares.
- `.tdease` sensitivity map: `settings.json` (MCP env/credentials),
  `permissions.json` (privilege whitelist), `sessions/**`, `workflows/**`,
  `jobs/**`, `events.jsonl`, `tmp/**` = runtime-private;
  `skills/**`, `agents/**`, `commands/**` = user assets, NOT denied
  (AGENT-CONTRACT denies writes to some of these, but reading user skill
  assets into an export is legitimate).
- List paths already exclude runtime dirs inconsistently; READ paths have no
  guard. Legit consumers read `.tdease/skills`, `.tdease/sessions` via other
  modules — so the guard goes on the render/export/agent-readBytes paths,
  NOT a blanket main-process IPC ban.
- Iframe sandbox `"allow-scripts"` is hardcoded twice: online hydration
  `markdown-hydration.ts:319` and export `conversation-export.ts:200`
  (asserted by `conversation-export.test.ts:110`). FRONTEND-INTERACTION-MAP
  §2.8 does not state the export iframe policy.

## Requirements

1. New shared predicate `isRuntimePrivateWorkspacePath(rel)` (module
   `src/studio/domain/runtime-private-path.ts`, next to
   workspace-snapshot-policy.ts) with the deny/exempt sets above; normalizes
   `./` prefixes, backslashes, case (win32), and repeated separators before
   matching.
2. Guard applied at exactly three call sites: export media embed
   (`agentConversation.ts` readWorkspaceDataUrl), online markdown hydration
   (`markdown-hydration.ts`), and the agent-side workspace readBytes bridge
   (`node-workspace-bridge.ts:86`, matching permission-gateway's
   credentials-denial posture). Hit → export degrades to the existing
   media-fallback card; hydration shows the existing mediaFailed state;
   agent read returns the existing denial error shape.
3. Iframe sandbox policy becomes ONE exported constant
   (`src/utils/iframe-sandbox-policy.ts`) consumed by both sites; ownership
   (renderer owns policy; export reuses the same constant) documented in
   `docs/design/FRONTEND-INTERACTION-MAP.md` §2.8.
4. `docs/STATUS.md` open item closed (main session applies centrally).

## Acceptance Criteria

- [ ] Unit tests for the predicate: deny/exempt sets + normalization
      variants (`./`, `\\`, mixed case, `.tdease/./settings.json`).
- [ ] `conversation-export.test.ts`: a transcript referencing
      `.tdease/settings.json` exports with the fallback card, not the file
      contents; the existing `allow-scripts` assertion still passes (same
      policy string, now from the shared module).
- [ ] Full `pnpm -C TDEase-FrontEnd test:run` green; lint clean.
- [ ] Footprint: `src/studio/domain/runtime-private-path.ts`(+test),
      `src/utils/iframe-sandbox-policy.ts`, `src/components/agent/
      agentConversation.ts`, `src/components/agent/markdown-hydration.ts`,
      `src/components/agent/conversation-export.ts`(+test),
      `electron/agent/node-workspace-bridge.ts`,
      `docs/design/FRONTEND-INTERACTION-MAP.md`. NOT: main.ts IPC handlers,
      STATUS.md, share-server.
