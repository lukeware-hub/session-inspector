import type { On } from 'claude-code'

import type { ContextReading } from '../domain/models'
import { addContextReading } from '../domain/reducers'
import { contextLevel, contextPercent, isAlertRise, levelLabel } from '../domain/thresholds'
import { changeContext, changeUsage, logEvent, readContext, type Engine } from '../state/repository'

export type ContextFigures = { tokens?: number; window: number; percent?: number }

// A reading from the engine's figures, or undefined while no response has reported a fill.
export function toReading(figures: ContextFigures, timestamp: number): ContextReading | undefined {
  const percent = figures.percent ?? contextPercent(figures.tokens, figures.window)
  if (figures.tokens === undefined || percent === undefined) return undefined
  return { tokens: figures.tokens, window: figures.window, percent, timestamp }
}

export async function recordContext($: Engine, figures: ContextFigures): Promise<void> {
  const at = await $.clock.now()
  const reading = toReading(figures, at)
  if (!reading) return

  const readings = await readContext($)
  const last = readings.at(-1)
  if (last && last.tokens === reading.tokens && last.window === reading.window) return

  await changeContext($, current => addContextReading(current, reading))
  const level = contextLevel(reading.percent)
  if (isAlertRise(last && contextLevel(last.percent), level)) {
    const label = `Context ${levelLabel(level)}: ${reading.percent}% of the window used`
    $.ui.toast(label)
    await logEvent($, { type: 'context.alert', label, timestamp: at })
  }
}

export function registerContextCollector(on: On): void {
  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('context')) await recordContext($, e.context)
    if (e.changed.includes('cost') || e.changed.includes('rateLimits')) {
      await changeUsage($, () => ({
        costUsd: e.cost?.usd,
        hasUnknownPrice: e.cost?.hasUnknownPrice,
        rateLimits: e.rateLimits.map(limit => ({ kind: limit.kind, percentUsed: limit.percentUsed, resetsAt: limit.resetsAt })),
      }))
    }
    return next(e)
  }).catch(($, e, next) => next(e))
}
