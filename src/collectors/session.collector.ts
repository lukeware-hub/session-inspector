import type { On } from 'claude-code'

import { formatDuration } from '../domain/formatters'
import type { SessionRecord } from '../domain/models'
import { addUsage, agentStatusFromReason, agentTurn, countTurn, finishAgent } from '../domain/reducers'
import {
  changeAgents,
  changeSession,
  changeStats,
  logEvent,
  readSession,
  resetState,
  touchSession,
  type Engine,
} from '../state/repository'
import { syncAgents } from './agents.collector'
import { captureGitBase, inBackground, refreshGit, sampleSystem } from './host.collector'
import { refreshPressure } from './insights.collector'

// Binds the state to the live session id; a new id (after /clear) starts the values over.
export async function syncSession($: Engine): Promise<void> {
  const [id, stored] = await Promise.all([$.session.id(), readSession($)])
  if (stored.id === id) return
  if (stored.id !== undefined) await resetState($)
  const [model, usage, at] = await Promise.all([$.session.model(), $.session.usage(), $.clock.now()])
  await changeSession($, (): SessionRecord => ({ id, model, status: 'idle', startTime: usage.startedAt, lastActivity: at }))
  await logEvent($, { type: 'session.start', label: 'Session started', timestamp: at })
  inBackground(captureGitBase($))
}

export function registerSessionCollector(on: On): void {
  on('session.end', async ($, e, next) => {
    const at = await $.clock.now()
    await changeSession($, (session): SessionRecord => ({ ...session, status: 'ended', endTime: at, endReason: e.reason }))
    await logEvent($, { type: 'session.end', label: `Session ended (${e.reason})`, timestamp: at })
    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.start', async ($, e, next) => {
    const at = await $.clock.now()
    const agentId = e.agentId
    if (agentId === undefined) {
      await syncSession($)
      await changeSession($, (session): SessionRecord => ({ ...session, status: 'running', lastActivity: at }))
      inBackground(sampleSystem($))
      inBackground(syncAgents($))
    } else {
      await changeAgents($, agents => agentTurn(agents, agentId))
      await touchSession($, at)
    }
    const stats = await changeStats($, current => countTurn(current, agentId !== undefined))
    const label = agentId === undefined ? `Turn ${stats.totalTurns} started` : 'Subagent turn started'
    await logEvent($, { type: 'turn.start', label, timestamp: at, agentId })
    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    const at = await $.clock.now()
    const agentId = e.agentId
    await changeStats($, stats => addUsage(stats, e.usage))
    if (agentId === undefined) {
      const model = await $.session.model()
      await changeSession($, (session): SessionRecord => ({ ...session, status: 'idle', model, lastActivity: at }))
      const label = `Turn finished (${e.reason}, ${formatDuration(e.durationMs)})`
      await logEvent($, { type: 'turn.complete', label, timestamp: at })
      inBackground(sampleSystem($))
      inBackground(syncAgents($))
      inBackground(refreshGit($))
      inBackground(refreshPressure($))
    } else {
      const status = agentStatusFromReason(e.reason)
      await changeAgents($, agents => finishAgent(agents, agentId, { status, at, durationMs: e.durationMs }))
      await touchSession($, at)
      await logEvent($, { type: 'agent.complete', label: `Subagent ${status}`, timestamp: at, agentId })
    }
    return next(e)
  }).catch(($, e, next) => next(e))
}
