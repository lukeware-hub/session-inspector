import type { On } from 'claude-code'

import { addSpeed, recordCompaction, tokensPerSecond } from '../domain/reducers'
import { changeSpeed, changeStats, logEvent } from '../state/repository'

// Model speed per request, and the moments the conversation was compacted.
export function registerSpeedCollector(on: On): void {
  on('turn.step', async function* ($, e, next) {
    const started = await $.clock.now()
    const result = yield* next(e)
    try {
      const speed = tokensPerSecond(result.usage?.output_tokens, (await $.clock.now()) - started)
      if (speed !== undefined) await changeSpeed($, current => addSpeed(current, speed))
    } catch {
      // A failed measurement leaves the stream as the engine sent it.
    }
    return result
  })

  on('session.compact', async ($, e, next) => {
    const result = await next(e)
    if (result.skip === undefined) {
      const at = await $.clock.now()
      await changeStats($, stats => recordCompaction(stats, at, e.trigger))
      await logEvent($, { type: 'context.compact', label: `Context compacted (${e.trigger})`, timestamp: at, agentId: e.agentId })
    }
    return result
  }).catch(($, e, next) => next(e))
}
