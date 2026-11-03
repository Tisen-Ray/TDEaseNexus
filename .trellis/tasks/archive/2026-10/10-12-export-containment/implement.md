# implement — export-containment

1. Read: `src/components/agent/agentConversation.ts` (whole),
   `src/components/agent/markdown-hydration.ts:160-360`,
   `src/components/agent/conversation-export.ts`(+test),
   `electron/agent/node-workspace-bridge.ts`,
   `src/studio/domain/workspace-snapshot-policy.ts`,
   `src/utils/markdown.ts:280-346`, `docs/design/FRONTEND-INTERACTION-MAP.md`
   §2.8.
2. Write the predicate + its unit test (deny/exempt/normalization matrix).
3. Wire the three call sites (null / mediaFailed / bridge denial).
4. Extract `IFRAME_SANDBOX_ATTRIBUTE`, rewire both iframe sites; the export
   test's existing string assertion must pass unchanged.
5. FRONTEND-INTERACTION-MAP §2.8: one short paragraph (export iframe
   sandbox semantics + policy owner + runtime-private export guard).
6. Targeted tests, then report. Full gates run centrally.

Validation (repo root):
```
pnpm -C TDEase-FrontEnd exec vitest run src/studio/domain/runtime-private-path.test.ts src/components/agent/conversation-export.test.ts
```

Rollback: `git checkout -- src/ docs/design/FRONTEND-INTERACTION-MAP.md`
+ delete new files.
