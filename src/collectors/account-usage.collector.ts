import type { Timer } from 'claude-code'

import { conversationLines } from '../domain/code-lines'
import { changeUsage, type Engine } from '../state/repository'
import { inBackground } from './host.collector'

// The rate-limit windows come only from Claude Code's own responses (session.measure); the
// inspector makes no network request for them.
const LIVE_USAGE_EVERY_MS = 10_000

let liveUsageTimer: Timer | undefined
let isReadingLiveUsage = false

// The session's cost as the engine totals it now. A measurement comes only with a model
// response, so other mods' model calls would otherwise wait for the next one to show.
export async function refreshLiveUsage($: Engine): Promise<void> {
  if (isReadingLiveUsage) return
  isReadingLiveUsage = true
  try {
    const { cost } = await $.session.usage()
    if (!cost) return
    await changeUsage($, current =>
      current.costUsd === cost.usd && current.hasUnknownPrice === cost.hasUnknownPrice
        ? current
        : { ...current, costUsd: cost.usd, hasUnknownPrice: cost.hasUnknownPrice },
    )
  } finally {
    isReadingLiveUsage = false
  }
}

// Reads the session's cost now and every ten seconds; a new session start replaces the timer.
export function startLiveUsagePoller($: Engine): void {
  liveUsageTimer?.cancel()
  inBackground(refreshLiveUsage($))
  liveUsageTimer = $.clock.every(LIVE_USAGE_EVERY_MS, () => inBackground(refreshLiveUsage($)))
}

// Counts the lines Edit and Write changed from the transcript: the main conversation and the
// subagents it started. Run when the inspector loads, so edits made before it (an install or
// reload mid-session) count too. A figure only grows: rows lost to a compaction never lower it.
export async function recountLines($: Engine): Promise<void> {
  const messages = await $.session.messages()
  const uses = messages.flatMap(message => message.toolUses)
  const agentIds = uses.flatMap(use => (use.agentId ? [use.agentId] : []))
  for (const agentId of agentIds) {
    const agent = await $.session.messages({ agentId })
    if (Array.isArray(agent)) uses.push(...agent.flatMap(message => message.toolUses))
  }
  const counted = conversationLines(uses)
  await changeUsage($, current => ({
    ...current,
    linesAdded: Math.max(current.linesAdded ?? 0, counted.added),
    linesRemoved: Math.max(current.linesRemoved ?? 0, counted.removed),
  }))
}
