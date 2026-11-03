/**
 * Wire protocol shared by the main-process client (utility-client.ts) and the
 * utilityProcess host (utility-host-core.ts / utility-host.ts).
 *
 * The agent runtime runs OUT of the Electron main process: a native crash in
 * node-pty, a runaway loop or an OOM from a huge tool output must never take
 * the whole app down. Both sides speak one bidirectional message protocol over
 * a single ordered port (utilityProcess.postMessage / process.parentPort —
 * a MessageChannelMain pair under the hood). Order is guaranteed, so request/
 * response correlation is by id and ledger ops replay in sequence.
 *
 * Message kinds:
 *   main → child: init · req · cres (reverse-call result)
 *   child → main: ready · res · ev (push fan-out) · call (reverse RPC for the
 *                 main-owned deps) · ledger (usage-ledger ops, ordered events)
 *
 * Every payload crosses clampForRelay() on the SENDING side: a message that
 * would otherwise clone a giant buffer into the receiving process is truncated
 * (strings) / dropped (tail of arrays and objects) with a marker, and the
 * sender logs a warning. The relay itself must not be an OOM vector.
 */

// ── Wire types ────────────────────────────────────────────────────────────────

/** Runtime methods main invokes in the child (the whole ipcMain agent surface). */
export type AgentHostMethod =
  | 'bindSession'
  | 'prompt'
  | 'abort'
  | 'compact'
  | 'fork'
  | 'dispose'
  | 'disposeAll'
  | 'resolveApproval'
  | 'listSubagents'
  | 'cancelSubagent'
  | 'peekSubagent'
  | 'listJobs'
  | 'listSessionRuns'
  | 'cancelJob'
  | 'peekJob'

/** Main-owned dependencies the child calls back into (reverse RPC). */
export type AgentDepMethod =
  | 'resolveWorkspaceRoot'
  | 'backendConnection'
  | 'resolveModelMeta'
  | 'nodeCatalogInstaller'

/** RuntimePush fan-out kinds (see contracts.ts RuntimePush). */
export type AgentPushKind =
  | 'turnEvent'
  | 'runsInvalidated'
  | 'subagents'
  | 'jobs'
  | 'sessionRuns'
  | 'view'
  | 'contextUsage'

export interface SerializedError {
  name: string
  message: string
  stack?: string
}

export interface RelayInit {
  t: 'init'
  /** Opaque to the protocol layer; AgentHostInit in utility-host-core.ts. */
  config: Record<string, unknown>
}

export interface RelayReady {
  t: 'ready'
}

export interface RelayRequest {
  t: 'req'
  id: number
  m: AgentHostMethod
  a: unknown[]
}

export interface RelayResponse {
  t: 'res'
  id: number
  ok: boolean
  v?: unknown
  e?: SerializedError
}

export interface RelayEvent {
  t: 'ev'
  k: AgentPushKind
  a: unknown[]
}

export interface RelayCall {
  t: 'call'
  id: number
  m: AgentDepMethod
  a: unknown[]
}

export interface RelayCallResult {
  t: 'cres'
  id: number
  ok: boolean
  v?: unknown
  e?: SerializedError
}

/** Usage-ledger ops, applied in arrival order on main's ledger instance. */
export interface RelayLedger {
  t: 'ledger'
  op: 'start' | 'finish' | 'recordError'
  a: unknown[]
}

export type RelayMessage =
  | RelayInit
  | RelayReady
  | RelayRequest
  | RelayResponse
  | RelayEvent
  | RelayCall
  | RelayCallResult
  | RelayLedger

// ── Error serialization ──────────────────────────────────────────────────────

export function serializeError(error: unknown): SerializedError {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack }
  }
  return { name: 'Error', message: String(error) }
}

export function deserializeError(wire: SerializedError | undefined, fallback: string): Error {
  if (!wire) return new Error(fallback)
  const error = new Error(wire.message)
  error.name = wire.name
  if (wire.stack) error.stack = wire.stack
  return error
}

// ── Size guard ───────────────────────────────────────────────────────────────

export const RELAY_STRING_CAP_BYTES = 2 * 1024 * 1024
export const RELAY_MESSAGE_CAP_BYTES = 16 * 1024 * 1024

export interface ClampOptions {
  stringCapBytes?: number
  messageCapBytes?: number
  byteLength?: (value: string) => number
}

export interface ClampResult<T> {
  value: T
  /** At least one string was truncated or one collection lost tail entries. */
  truncated: boolean
  /** The clamped form still exceeded the message cap and was replaced by a
   * small marker object — the receiver sees an explicit tombstone. */
  dropped: boolean
}

const TRUNCATION_MARKER = '\n…[truncated by agent utility relay]'

/**
 * Deep-clamp a relay payload so no single message can OOM the peer: strings
 * over stringCapBytes are sliced with a marker, and collection entries stop
 * being copied once messageCapBytes is exhausted. Values are never mutated —
 * the walk builds a clamped copy only where clamping happens.
 */
export function clampForRelay<T>(value: T, options: ClampOptions = {}): ClampResult<T> {
  const stringCap = options.stringCapBytes ?? RELAY_STRING_CAP_BYTES
  const messageCap = options.messageCapBytes ?? RELAY_MESSAGE_CAP_BYTES
  const byteLength = options.byteLength ?? ((s: string) => s.length * 2)
  let truncated = false
  let budget = messageCap

  function walk(node: unknown): unknown {
    if (typeof node === 'string') {
      const size = byteLength(node)
      if (size <= stringCap && size <= budget) {
        budget -= size
        return node
      }
      truncated = true
      // Slice by chars until the smaller of the string cap and the remaining
      // message budget is met; the marker rides WITHIN that limit so the
      // clamped string never exceeds its own cap. A budget too small to hold
      // marker + content degrades to the empty string rather than inflating
      // past the cap.
      const markerBytes = byteLength(TRUNCATION_MARKER)
      const limit = Math.min(stringCap, Math.max(0, budget))
      if (limit <= markerBytes) {
        budget = 0
        return ''
      }
      let sliced = node.slice(0, limit)
      while (sliced.length > 0 && byteLength(sliced) + markerBytes > limit) {
        sliced = node.slice(0, sliced.length - 1)
      }
      budget -= byteLength(sliced)
      return sliced + TRUNCATION_MARKER
    }
    if (node === null || typeof node !== 'object') return node
    if (Array.isArray(node)) {
      const out: unknown[] = []
      budget -= 16
      for (const entry of node) {
        if (budget <= 0) {
          truncated = true
          break
        }
        out.push(walk(entry))
      }
      return out
    }
    // Structured-cloneable exotica (Uint8Array image attachments, Buffers,
    // Dates, Maps) must pass through VERBATIM — Object.entries would gut them.
    // Only plain records are walked for clamping; their byte size is still
    // accounted below by estimateSize on the tombstone check.
    const proto: unknown = Object.getPrototypeOf(node)
    if (proto !== Object.prototype && proto !== null) return node
    const out: Record<string, unknown> = {}
    budget -= 16
    for (const [key, entry] of Object.entries(node as Record<string, unknown>)) {
      budget -= byteLength(key)
      if (budget <= 0) {
        truncated = true
        break
      }
      out[key] = walk(entry)
    }
    return out
  }

  const clamped = walk(value)
  // Second estimate on the clamped form: if the walk could not bring it under
  // the cap (degenerate shapes, e.g. millions of tiny entries), replace it.
  if (typeof clamped === 'object' && clamped !== null && estimateSize(clamped, byteLength) > messageCap) {
    return { value: { __relayDropped: true } as T, truncated: true, dropped: true }
  }
  return { value: clamped as T, truncated, dropped: false }
}

function estimateSize(node: unknown, byteLength: (s: string) => number): number {
  if (typeof node === 'string') return byteLength(node)
  if (ArrayBuffer.isView(node)) return node.byteLength
  if (node === null || typeof node !== 'object') return 8
  if (Array.isArray(node)) return node.reduce((sum, entry) => sum + estimateSize(entry, byteLength), 16)
  return Object.entries(node as Record<string, unknown>).reduce(
    (sum, [key, entry]) => sum + byteLength(key) + estimateSize(entry, byteLength),
    16,
  )
}

/** Test helper: a byteLength that matches Buffer.byteLength for ASCII. */
export const asciiByteLength = (s: string): number => s.length
