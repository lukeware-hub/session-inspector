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
import { changeAgents, changeFiles, changeStats, changeTools, logEvent, touchSession } from '../state/repository'

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
    if (file) {
      const path = relativePath(file.path, await $.session.cwd())
      await changeFiles($, files => recordFile(files, path, file.touch, at))
    }
    await touchSession($, at)
    await logEvent($, { type: 'tool.call', label: name, timestamp: at, toolName: name, agentId })

    const ran = await next(e)
    const end = await $.clock.now()
    const outcome: ToolOutcome = ran.deny !== undefined ? 'denied' : ran.isError === true ? 'error' : 'ok'
    await changeTools($, tools => finishTool(tools, name, end - at, outcome))
    if (outcome === 'denied') await logEvent($, { type: 'tool.denied', label: `${name} denied`, timestamp: end, toolName: name, agentId })
    if (outcome === 'error') await logEvent($, { type: 'tool.error', label: `${name} failed`, timestamp: end, toolName: name, agentId })
    return ran
  }).catch(($, e, next) => next(e))
}
