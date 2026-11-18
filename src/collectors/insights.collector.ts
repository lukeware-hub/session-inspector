import {
  addCall,
  addLoopAlert,
  addTurnTokens,
  callSignature,
  detectLoop,
  estimateTokens,
  recordLargest,
} from '../domain/insights'
import { addResultTokens } from '../domain/reducers'
import { changeLoop, changePressure, changeResults, changeTools, logEvent, type Engine } from '../state/repository'

// After a main turn: the context size it ended on, and where auto-compaction runs (a local estimate, no request).
export async function refreshPressure($: Engine): Promise<void> {
  const { context } = await $.session.usage({ breakdown: 'summary' })
  const threshold = context.breakdown?.autoCompactThreshold
  const isAutoCompact = context.breakdown?.isAutoCompactEnabled
  const tokens = context.tokens
  await changePressure($, pressure => {
    const next = { ...pressure, threshold, isAutoCompact }
    return tokens === undefined ? next : addTurnTokens(next, tokens)
  })
}

export type FinishedCall = {
  tool: string
  input: Record<string, unknown>
  file?: string
  resultText?: string
  failed: boolean
  agentId?: string
  at: number
}

// What a finished call adds to the context, and whether it makes the agent look stuck.
export async function recordCallInsights($: Engine, call: FinishedCall): Promise<void> {
  const tokens = estimateTokens(call.resultText)
  if (tokens > 0) {
    await changeTools($, tools => addResultTokens(tools, call.tool, tokens))
    await changeResults($, results => recordLargest(results, { tool: call.tool, target: call.file, tokens, at: call.at }))
  }

  const signature = callSignature(call.tool, call.input, call.file)
  const loop = await changeLoop($, current => addCall(current, { ...signature, at: call.at, failed: call.failed }))
  const alert = detectLoop(loop.recent)
  if (!alert) return
  await changeLoop($, current => addLoopAlert(current, call.at, alert))
  $.ui.toast(`Possible loop: ${alert}`)
  await logEvent($, { type: 'loop.alert', label: alert, timestamp: call.at, toolName: call.tool, agentId: call.agentId })
}
