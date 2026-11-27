import type { On } from 'claude-code'

import { spawnAgent, syncAgentStatuses } from '../domain/reducers'
import { changeAgents, logEvent, touchSession, type Engine } from '../state/repository'

// Brings the recorded agents' statuses in line with the engine's live list, so a stopped agent stops counting as running.
export async function syncAgents($: Engine): Promise<void> {
  const live = await $.agent.list()
  await changeAgents($, agents => syncAgentStatuses(agents, live))
}

// Records an agent only once the engine says it started, with the id it gave.
export function registerAgentsCollector(on: On): void {
  on('agent.spawn', async ($, e, next) => {
    const spawned = await next(e)
    const id = spawned.agentId
    if (id === undefined) return spawned

    // The agent has started: a failure while recording it must not reach `.catch`, which would start it again.
    try {
      const at = await $.clock.now()
      const spawn = { id, type: e.subagentType, description: e.description ?? '', model: spawned.model, at }
      await changeAgents($, agents => spawnAgent(agents, spawn))
      await touchSession($, at)
      await logEvent($, { type: 'agent.spawn', label: `${e.subagentType} spawned`, timestamp: at, agentId: id })
    } catch {
      // Recording is best effort; the spawn goes on unchanged.
    }
    return spawned
  }).catch(($, e, next) => next(e))
}
