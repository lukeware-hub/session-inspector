import type { On } from 'claude-code'

import { spawnAgent } from '../domain/reducers'
import { changeAgents, logEvent, touchSession } from '../state/repository'

// Records an agent only once the engine says it started, with the id it gave.
export function registerAgentsCollector(on: On): void {
  on('agent.spawn', async ($, e, next) => {
    const spawned = await next(e)
    const id = spawned.agentId
    if (id === undefined) return spawned

    const at = await $.clock.now()
    const spawn = { id, type: e.subagentType, description: e.description, model: spawned.model, at }
    await changeAgents($, agents => spawnAgent(agents, spawn))
    await touchSession($, at)
    await logEvent($, { type: 'agent.spawn', label: `${e.subagentType} spawned`, timestamp: at, agentId: id })
    return spawned
  }).catch(($, e, next) => next(e))
}
