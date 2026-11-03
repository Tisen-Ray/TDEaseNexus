/**
 * Host side of the agent utility-process relay, as a pure attachable session.
 *
 * createAgentHost() wires an AgentRuntime to a port in two phases (the push
 * callbacks exist before the runtime, but parent-session routing needs the
 * runtime — a late-bound accessor closes the cycle):
 *  - the returned `push` is handed to createAgentRuntime() by the entry;
 *  - attach(runtime) then dispatches RelayRequest messages to runtime methods
 *    (the entire ipcMain agent surface, unchanged in shape);
 *  - the runtime's RuntimePush fans out as RelayEvent messages — turnEvent
 *    additionally carries the PARENT session id, resolved child-side, because
 *    main's owner-map routing needs it and must not make a round-trip per event;
 *  - main-owned dependencies (workspace registry, model metadata,
 *    node-catalog install) are exposed as reverse calls over the port;
 *  - the usage ledger is proxied: the requestId is generated child-side (the
 *    ledger treats it as an opaque handle) and start/finish/recordError are
 *    replayed on main's single ledger instance in arrival order, so usage rows
 *    keep landing in the file the renderer's StatisticsPanel reads.
 *
 * utility-host.ts is the thin utilityProcess entry that adapts
 * process.parentPort to HostPort and constructs the runtime; everything here
 * is unit-testable against an in-memory port pair.
 */
import { randomUUID } from 'node:crypto'

import type { UsageLedger } from '../../src/ai/core/usage-ledger'
import type { AgentRuntime, BackendConnection } from './agent-runtime'
import type { RuntimePush } from './contracts'
import {
  clampForRelay,
  deserializeError,
  serializeError,
  type AgentDepMethod,
  type AgentPushKind,
  type RelayCall,
  type RelayMessage,
} from './utility-protocol'

/** Minimal ordered message port (utilityProcess parentPort, or a test double). */
export interface HostPort {
  post(message: unknown): void
  onMessage(listener: (message: unknown) => void): void
}

/** Reverse-call surface into main-owned state. backendConnection is a
 * snapshot request; see createAgentHost for the sync cache it feeds. */
export interface HostMainDeps {
  resolveWorkspaceRoot(workspaceId: string): Promise<string>
  backendConnection(): Promise<BackendConnection>
  resolveModelMeta?(providerId: string, modelId: string): Promise<unknown>
  nodeCatalogInstaller?(sourceDir: string): Promise<unknown>
}

export interface HostLogger {
  info(event: string, details?: unknown): void
  warn(event: string, details?: unknown): void
  error(event: string, details?: unknown): void
}

export interface AgentHostOptions {
  port: HostPort
  logger?: HostLogger
}

interface PendingCall {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
}

export function createAgentHost(options: AgentHostOptions): {
  push: RuntimePush
  ledger: UsageLedger
  /** Sync read of the latest backend-connection snapshot. */
  backendConnection: () => BackendConnection
  /** Reverse RPC into main-owned state (workspace registry, model metadata…). */
  call(method: AgentDepMethod, args: unknown[]): Promise<unknown>
  attach(runtime: AgentRuntime): { dispose(): void }
} {
  const { port } = options
  const logger: HostLogger = options.logger ?? consoleLogger
  let nextCallId = 1
  const pendingCalls = new Map<number, PendingCall>()
  let backendSnapshot: BackendConnection | null = null
  let parentSessionOf: ((childSessionId: string) => string | undefined) | null = null

  function callMain(method: AgentDepMethod, args: unknown[]): Promise<unknown> {
    const id = nextCallId++
    return new Promise((resolve, reject) => {
      pendingCalls.set(id, { resolve, reject })
      port.post({ t: 'call', id, m: method, a: args } satisfies RelayCall)
    })
  }

  function refreshBackendConnection(): void {
    void callMain('backendConnection', [])
      .then((snapshot) => { backendSnapshot = snapshot as BackendConnection })
      .catch(() => undefined)
  }

  function pushEvent(kind: AgentPushKind, args: unknown[]): void {
    const clamped = clampForRelay({ t: 'ev', k: kind, a: args })
    if (clamped.truncated) logger.warn('agent-host.push-clamped', { kind, dropped: clamped.dropped })
    port.post(clamped.value)
  }

  const push: RuntimePush = {
    turnEvent: (sessionId, event) => {
      // Parent routing resolved child-side: main's owner map only knows parent
      // sessions, and a per-event reverse lookup would be async.
      pushEvent('turnEvent', [sessionId, event, parentSessionOf?.(sessionId)])
    },
    runsInvalidated: (workspaceId) => pushEvent('runsInvalidated', [workspaceId]),
    subagents: (sessionId, snapshot) => pushEvent('subagents', [sessionId, snapshot]),
    jobs: (sessionId, snapshot) => pushEvent('jobs', [sessionId, snapshot]),
    sessionRuns: (sessionId, snapshot) => pushEvent('sessionRuns', [sessionId, snapshot]),
    view: (sessionId, envelope) => pushEvent('view', [sessionId, envelope]),
    contextUsage: (sessionId, usage) => pushEvent('contextUsage', [sessionId, usage]),
  }

  const ledger: UsageLedger = {
    // requestId is an opaque handle end to end; generating it child-side keeps
    // start() synchronous while the op replays on main's ledger in order.
    start: (meta) => {
      const handle = { requestId: randomUUID(), startedAt: new Date().toISOString() }
      sendLedger('start', [handle, meta])
      return handle
    },
    finish: (requestId, result) => { sendLedger('finish', [requestId, result]); return null },
    recordError: (requestId, error, status, result) => {
      sendLedger('recordError', [requestId, error instanceof Error ? error.message : String(error), status, result])
      return null
    },
    list: () => [],
    subscribe: () => () => undefined,
    clear: () => undefined,
    flush: () => undefined,
  }

  function sendLedger(op: 'start' | 'finish' | 'recordError', args: unknown[]): void {
    const clamped = clampForRelay({ t: 'ledger', op, a: args })
    if (clamped.truncated) logger.warn('agent-host.ledger-clamped', { op })
    port.post(clamped.value)
  }

  function respond(id: number, ok: boolean, value: unknown): void {
    if (!ok) {
      port.post({ t: 'res', id, ok: false, e: serializeError(value) })
      return
    }
    const clamped = clampForRelay(value)
    if (clamped.truncated) logger.warn('agent-host.response-clamped', { id, dropped: clamped.dropped })
    port.post({ t: 'res', id, ok: true, v: clamped.value })
  }

  function attach(runtime: AgentRuntime): { dispose(): void } {
    parentSessionOf = (childSessionId) => runtime.parentSessionOf(childSessionId)

    async function dispatch(method: string, args: unknown[]): Promise<unknown> {
      const target = (runtime as unknown as Record<string, (...callArgs: unknown[]) => unknown>)[method]
      if (typeof target !== 'function') throw new Error(`agent-host: unknown method ${String(method)}`)
      return target.apply(runtime, args)
    }

    port.onMessage((raw) => {
      const message = raw as RelayMessage
      if (!message || typeof message !== 'object' || typeof message.t !== 'string') return
      if (message.t === 'req') {
        // Refresh the backend snapshot ahead of every request: bindSession and
        // run dispatch read it synchronously inside the child.
        refreshBackendConnection()
        void dispatch(message.m, message.a)
          .then((value) => respond(message.id, true, value))
          .catch((error: unknown) => respond(message.id, false, error))
        return
      }
      if (message.t === 'cres') {
        const pending = pendingCalls.get(message.id)
        if (!pending) return
        pendingCalls.delete(message.id)
        if (message.ok) pending.resolve(message.v)
        else pending.reject(deserializeError(message.e, `agent-host reverse call failed`))
      }
    })

    return {
      dispose() {
        for (const pending of pendingCalls.values()) {
          pending.reject(new Error('agent-host session disposed'))
        }
        pendingCalls.clear()
      },
    }
  }

  // Seed the backend snapshot immediately; until it lands the sync read throws
  // exactly like main's backendConnectionInfo() does before the backend is up.
  refreshBackendConnection()

  return {
    push,
    ledger,
    backendConnection: () => {
      if (!backendSnapshot) throw new Error('Backend connection is not ready')
      return backendSnapshot
    },
    call: callMain,
    attach,
  }
}

const consoleLogger: HostLogger = {
  info: () => undefined,
  warn: (event, details) => console.warn(`[agent-host] ${event}`, details ?? ''),
  error: (event, details) => console.error(`[agent-host] ${event}`, details ?? ''),
}
