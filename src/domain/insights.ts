import type { CallSignature, LoopRecord, PressureRecord, ResultRecord } from './models'
import { pushCapped } from './reducers'

export const TURN_SAMPLES = 12
export const LARGEST_RESULTS = 10
export const RECENT_CALLS = 20
export const LOOP_ALERTS = 5
export const LOOP_REPEATS = 4
export const LOOP_WINDOW_MS = 3 * 60_000
export const FAILURE_STREAK = 3

// Context forecast

// The token count where the context stops growing: auto-compaction when it runs, else the window.
export function compactionLimit(pressure: PressureRecord, window: number): number {
  return pressure.isAutoCompact && pressure.threshold ? Math.min(pressure.threshold, window) : window
}

export function addTurnTokens(pressure: PressureRecord, tokens: number): PressureRecord {
  return { ...pressure, turnTokens: pushCapped(pressure.turnTokens, tokens, TURN_SAMPLES) }
}

export type Forecast = { growthPerTurn?: number; turnsLeft?: number }

// Average growth per turn since the last drop (a compaction), and the turns left at that pace.
export function forecastTurns(turnTokens: readonly number[], current: number, limit: number): Forecast {
  if (current >= limit) return { turnsLeft: 0 }
  const lastDrop = turnTokens.findLastIndex((tokens, index) => index > 0 && tokens < (turnTokens[index - 1] ?? 0))
  const samples = turnTokens.slice(Math.max(0, lastDrop)).slice(-6)
  if (samples.length < 2) return {}
  const growthPerTurn = Math.round(((samples.at(-1) ?? 0) - (samples[0] ?? 0)) / (samples.length - 1))
  if (growthPerTurn <= 0) return { growthPerTurn }
  return { growthPerTurn, turnsLeft: Math.ceil((limit - current) / growthPerTurn) }
}

// Context use

// A rough token count for text the model reads: about four characters a token.
export function estimateTokens(text: string | undefined): number {
  return text ? Math.ceil(text.length / 4) : 0
}

// Keeps the largest results, biggest first.
export function recordLargest(results: readonly ResultRecord[], result: ResultRecord): ResultRecord[] {
  return [...results, result].sort((a, b) => b.tokens - a.tokens).slice(0, LARGEST_RESULTS)
}

// Loop detection

const RESERVED = new Set(['tool', 'tool_use_id', 'agentId', 'consent'])

// FNV-1a: a short fingerprint, so a call is compared without keeping its arguments.
export function fingerprint(text: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16)
}

// The call's arguments in a stable order, without the engine's own keys.
function stableArguments(input: Record<string, unknown>): string {
  return JSON.stringify(
    Object.keys(input)
      .filter(key => !RESERVED.has(key))
      .sort()
      .map(key => [key, input[key]]),
  )
}

// What makes two calls "the same": the tool and a fingerprint of its arguments. The label shows only the tool and file.
export function callSignature(tool: string, input: Record<string, unknown>, file: string | undefined): Pick<CallSignature, 'signature' | 'label'> {
  return { signature: `${tool}:${fingerprint(stableArguments(input))}`, label: file ? `${tool} ${file}` : tool }
}

// An alert the first time a call repeats LOOP_REPEATS times within the window, or calls fail FAILURE_STREAK times in a row.
export function detectLoop(recent: readonly CallSignature[]): string | undefined {
  const last = recent.at(-1)
  if (!last) return undefined
  const same = recent.filter(call => call.signature === last.signature && last.at - call.at <= LOOP_WINDOW_MS)
  if (same.length === LOOP_REPEATS) {
    const minutes = Math.max(1, Math.ceil((last.at - (same[0]?.at ?? last.at)) / 60_000))
    return `${last.label} repeated ${same.length}× in ${minutes} min`
  }
  const tail = recent.slice(-FAILURE_STREAK)
  const isNewStreak = tail.length === FAILURE_STREAK && tail.every(call => call.failed) && !recent.at(-FAILURE_STREAK - 1)?.failed
  return isNewStreak ? `${FAILURE_STREAK} tool calls failed in a row` : undefined
}

export function addCall(loop: LoopRecord, call: CallSignature): LoopRecord {
  return { ...loop, recent: pushCapped(loop.recent, call, RECENT_CALLS) }
}

export function addLoopAlert(loop: LoopRecord, at: number, label: string): LoopRecord {
  return { ...loop, alerts: pushCapped(loop.alerts, { at, label }, LOOP_ALERTS) }
}

// The latest alert, while it is still recent enough to show.
export function activeLoopAlert(loop: LoopRecord, now: number): string | undefined {
  const last = loop.alerts.at(-1)
  return last && now - last.at <= LOOP_WINDOW_MS ? last.label : undefined
}
