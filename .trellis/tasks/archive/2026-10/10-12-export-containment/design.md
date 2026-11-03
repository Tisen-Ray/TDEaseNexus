# design — export-containment

## The predicate

`src/studio/domain/runtime-private-path.ts`:

```ts
isRuntimePrivateWorkspacePath(rel: string): boolean
```

- Normalize first: strip leading `./`, convert `\` → `/`, lowercase,
  collapse repeated separators. (Anchors: permission-gateway.ts:243,308
  normalization + relative() in desktopWorkspace.ts:135-138.)
- DENY (workspace-relative, `.tdease/`-rooted):
  `.tdease/settings.json`, `.tdease/permissions.json`,
  `.tdease/sessions/**`, `.tdease/workflows/**`, `.tdease/jobs/**`,
  `.tdease/events.jsonl`, `.tdease/tool-audit.jsonl`, `.tdease/tmp/**`.
- EXEMPT: `.tdease/skills/**`, `.tdease/agents/**`, `.tdease/commands/**`
  (user assets; AGENT-CONTRACT's denial there is about WRITES/agent reads,
  not export rendering of user-owned content).
- Anything outside `.tdease/` → false (guard is containment, not a filter).

## Call sites (exactly three)

1. `agentConversation.ts` `readWorkspaceDataUrl`: hit → return null →
   existing export media-fallback card (`conversation-export.ts` already
   renders it for unreadable blobs).
2. `markdown-hydration.ts` (both lazy-blob and iframe hydration): hit →
   existing mediaFailed state.
3. `electron/agent/node-workspace-bridge.ts:86` readBytes: hit → the same
   denial error shape the bridge already returns for contained-path
   violations (agent-facing, consistent with permission-gateway's
   credential-denial posture).

Deliberately NOT guarded: `main.ts` `workspace:read-bytes` IPC (legit
consumers read `.tdease/skills` etc. through it), share-server (has its own
list-side policy), snapshot policy.

## Iframe policy ownership

`src/utils/iframe-sandbox-policy.ts` exports
`IFRAME_SANDBOX_ATTRIBUTE = 'allow-scripts'` (the exact string both sites
embed today, asserted by conversation-export.test.ts:110). Both
`markdown-hydration.ts:319` and `conversation-export.ts:200` consume it.
Owner: the renderer utils module — export reuses the online policy rather
than defining a second one. Documented in FRONTEND-INTERACTION-MAP §2.8
(the map's export section states the sandbox attribute and its owner).

## Threat model note

The path originates in transcript markdown (model-authored), so the guard
sits AFTER markdown's own attribute extraction but BEFORE any IPC: the
normalization happens on the extracted attribute string
(`unescapeAttr` first, conversation-export.ts:176-182) — the same value the
main process would resolve.

## Rollback

Revert; no persisted formats, no IPC contract changes.
