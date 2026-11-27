import type { On } from 'claude-code'

import { relativePath } from '../domain/formatters'
import {
  agentToolCall,
  countToolCall,
  finishTool,
  recordFile,
  recordTool,
  type FileTouch,
  type ToolOutcome,
} from '../domain/reducers'
import { toolLines } from '../domain/code-lines'
import { changeAgents, changeFiles, changeStats, changeTools, changeUsage, logEvent, touchSession, type Engine } from '../state/repository'
import { recordCallInsights } from './insights.collector'

const FILE_TOUCH: Record<string, FileTouch> = {
  Read: 'read',
  Edit: 'edit',
  MultiEdit: 'edit',
  Write: 'edit',
  NotebookEdit: 'edit',
}

// The file a file tool works on: the only argument the inspector keeps.
export function touchedFile(tool: string, input: Record<string, unknown>): { path: string; touch: FileTouch } | undefined {
  const touch = FILE_TOUCH[tool]
  const path = input.file_path ?? input.notebook_path
  return touch && typeof path === 'string' && path ? { path, touch } : undefined
}

// Counts every tool call by name, time and outcome; its input and output are never kept.
export function registerToolsCollector(on: On): void {
  on('tool.call', async ($, e, next) => {
    const at = await $.clock.now()
    const name = String(e.tool)
    const agentId = e.agentId
    await changeTools($, tools => recordTool(tools, name, at))
    await changeStats($, countToolCall)
    if (agentId !== undefined) await changeAgents($, agents => agentToolCall(agents, agentId, name))
    const file = touchedFile(name, e)
    const path = file && relativePath(file.path, await $.session.cwd())
    if (file && path) await changeFiles($, files => recordFile(files, path, file.touch, at))
    await touchSession($, at)
    await logEvent($, { type: 'tool.call', label: name, timestamp: at, toolName: name, agentId })

    const ran = await next(e)
    // The call has run: a failure while recording it must not reach `.catch`, which would run the call again.
    try {
      await recordFinished($, ran, name, at, path, e, agentId)
    } catch {
      // Metrics are best effort; the engine's answer goes on unchanged.
    }
    return ran
  }).catch(($, e, next) => next(e))
}

type Ran = { deny?: unknown; isError?: boolean; result?: unknown; text?: string }

async function recordFinished(
  $: Engine,
  ran: Ran,
  name: string,
  at: number,
  path: string | undefined,
  input: Record<string, unknown>,
  agentId: string | undefined,
): Promise<void> {
  const end = await $.clock.now()
  const outcome: ToolOutcome = ran.deny !== undefined ? 'denied' : ran.isError === true ? 'error' : 'ok'
  await changeTools($, tools => finishTool(tools, name, end - at, outcome))
  if (outcome === 'denied') await logEvent($, { type: 'tool.denied', label: `${name} denied`, timestamp: end, toolName: name, agentId })
  if (outcome === 'error') await logEvent($, { type: 'tool.error', label: `${name} failed`, timestamp: end, toolName: name, agentId })
  const lines = outcome === 'ok' ? toolLines(name, ran.result) : undefined
  if (lines && (lines.added || lines.removed)) {
    await changeUsage($, usage => ({
      ...usage,
      linesAdded: (usage.linesAdded ?? 0) + lines.added,
      linesRemoved: (usage.linesRemoved ?? 0) + lines.removed,
    }))
  }
  await recordCallInsights($, { tool: name, input, file: path, resultText: ran.text, failed: outcome !== 'ok', agentId, at: end })
}
