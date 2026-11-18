import {
  ACTIVITY_LIMIT,
  AGENT_DESCRIPTION_LIMIT,
  CONTEXT_HISTORY_LIMIT,
  FILES_LIMIT,
  SAMPLE_HISTORY_LIMIT,
  type ActivityLog,
  type AgentRecord,
  type ContextReading,
  type FileRecord,
  type InspectorEvent,
  type SessionMetrics,
  type SessionRecord,
  type SpeedRecord,
  type ToolMetrics,
} from './models'

export type EventInput = Omit<InspectorEvent, 'sequence'>

export type TokenUsage = {
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens: number
  cache_creation_input_tokens: number
}

export type ToolShare = { name: string; executions: number; share: number }

// Appends and keeps only the newest `max` items.
export function pushCapped<T>(list: readonly T[], item: T, max: number): T[] {
  return [...list, item].slice(-Math.max(1, max))
}

// Numbers an event and drops empty optional fields.
export function normalizeEvent(sequence: number, input: EventInput): InspectorEvent {
  const event: InspectorEvent = { sequence, type: input.type, label: input.label.trim() || input.type }
  if (Number.isFinite(input.timestamp)) event.timestamp = input.timestamp
  if (input.toolName) event.toolName = input.toolName
  if (input.agentId) event.agentId = input.agentId
  return event
}

export function appendEvent(log: ActivityLog, input: EventInput): ActivityLog {
  const total = log.total + 1
  return { total, items: pushCapped(log.items, normalizeEvent(total, input), ACTIVITY_LIMIT) }
}

export function addContextReading(readings: readonly ContextReading[], reading: ContextReading): ContextReading[] {
  return pushCapped(readings, reading, CONTEXT_HISTORY_LIMIT)
}

export function recordTool(tools: readonly ToolMetrics[], name: string, at: number): ToolMetrics[] {
  const found = tools.some(tool => tool.name === name)
  if (!found) return [...tools, { name, executions: 1, errors: 0, denials: 0, totalMs: 0, maxMs: 0, resultTokens: 0, lastExecution: at }]
  return tools.map(tool =>
    tool.name === name ? { ...tool, executions: tool.executions + 1, lastExecution: at } : tool,
  )
}

export type ToolOutcome = 'ok' | 'error' | 'denied'

// Adds how long a call took and how it ended to a tool already seen.
export function finishTool(tools: readonly ToolMetrics[], name: string, durationMs: number, outcome: ToolOutcome): ToolMetrics[] {
  const ms = Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 0
  return tools.map(tool =>
    tool.name === name
      ? {
          ...tool,
          totalMs: tool.totalMs + ms,
          maxMs: Math.max(tool.maxMs, ms),
          errors: tool.errors + (outcome === 'error' ? 1 : 0),
          denials: tool.denials + (outcome === 'denied' ? 1 : 0),
        }
      : tool,
  )
}

// Adds the estimated size of a result the model read to a tool already seen.
export function addResultTokens(tools: readonly ToolMetrics[], name: string, tokens: number): ToolMetrics[] {
  return tools.map(tool => (tool.name === name ? { ...tool, resultTokens: tool.resultTokens + tokens } : tool))
}

// Tools by average duration, slowest first.
export function slowestTools(tools: readonly ToolMetrics[]): (ToolMetrics & { averageMs: number })[] {
  return tools
    .map(tool => ({ ...tool, averageMs: tool.executions ? tool.totalMs / tool.executions : 0 }))
    .filter(tool => tool.totalMs > 0)
    .sort((a, b) => b.averageMs - a.averageMs)
}

export type ToolGroup = { server: string; executions: number; tools: string[] }

const MCP_NAME = /^mcp__(.+?)__(.+)$/

// The MCP server of a tool named mcp__<server>__<tool>, or undefined for a built-in tool.
export function mcpServer(name: string): string | undefined {
  return MCP_NAME.exec(name)?.[1]
}

// MCP tool calls grouped by server, most used first.
export function mcpGroups(tools: readonly ToolMetrics[]): ToolGroup[] {
  const groups = new Map<string, ToolGroup>()
  for (const tool of tools) {
    const server = mcpServer(tool.name)
    if (!server) continue
    const group = groups.get(server) ?? { server, executions: 0, tools: [] }
    group.executions += tool.executions
    group.tools.push(tool.name.slice(`mcp__${server}__`.length))
    groups.set(server, group)
  }
  return [...groups.values()].sort((a, b) => b.executions - a.executions)
}

export type FileTouch = 'read' | 'edit'

// Counts a read or an edit of a path, keeping the most recently touched files.
export function recordFile(files: readonly FileRecord[], path: string, touch: FileTouch, at: number): FileRecord[] {
  const old = files.find(file => file.path === path) ?? { path, reads: 0, edits: 0, lastAt: at }
  const next: FileRecord = {
    path,
    reads: old.reads + (touch === 'read' ? 1 : 0),
    edits: old.edits + (touch === 'edit' ? 1 : 0),
    lastAt: at,
  }
  return [...files.filter(file => file.path !== path), next].slice(-FILES_LIMIT)
}

export function recordCompaction(stats: SessionMetrics, at: number, trigger: string): SessionMetrics {
  return { ...stats, compactions: stats.compactions + 1, lastCompaction: { at, trigger } }
}

// Output tokens per second of one model request, or undefined when it cannot be measured.
export function tokensPerSecond(outputTokens: number | undefined, durationMs: number): number | undefined {
  if (!outputTokens || !Number.isFinite(durationMs) || durationMs <= 0) return undefined
  return Math.round((outputTokens / durationMs) * 1000)
}

export function addSpeed(speed: SpeedRecord, value: number): SpeedRecord {
  return { tokensPerSecond: value, history: pushCapped(speed.history, value, SAMPLE_HISTORY_LIMIT) }
}

// Tools by executions, most used first, each with its share of all calls.
export function toolDistribution(tools: readonly ToolMetrics[]): ToolShare[] {
  const total = tools.reduce((sum, tool) => sum + tool.executions, 0)
  return [...tools]
    .sort((a, b) => b.executions - a.executions || a.name.localeCompare(b.name))
    .map(tool => ({ name: tool.name, executions: tool.executions, share: total ? tool.executions / total : 0 }))
}

export function countTurn(stats: SessionMetrics, isSubagent: boolean): SessionMetrics {
  return isSubagent
    ? { ...stats, totalSubagentTurns: stats.totalSubagentTurns + 1 }
    : { ...stats, totalTurns: stats.totalTurns + 1 }
}

export function countToolCall(stats: SessionMetrics): SessionMetrics {
  return { ...stats, totalToolCalls: stats.totalToolCalls + 1 }
}

// Adds a turn's token usage to the session totals; missing usage changes nothing.
export function addUsage(stats: SessionMetrics, usage: TokenUsage | undefined): SessionMetrics {
  if (!usage) return stats
  return {
    ...stats,
    inputTokens: stats.inputTokens + safe(usage.input_tokens),
    outputTokens: stats.outputTokens + safe(usage.output_tokens),
    cacheReadTokens: stats.cacheReadTokens + safe(usage.cache_read_input_tokens),
    cacheCreationTokens: stats.cacheCreationTokens + safe(usage.cache_creation_input_tokens),
  }
}

function safe(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0
}

export function totalTokens(stats: SessionMetrics): number {
  return stats.inputTokens + stats.outputTokens + stats.cacheReadTokens + stats.cacheCreationTokens
}

// Time since the session began, up to its end when it ended; undefined before it is known.
export function sessionDurationMs(session: SessionRecord, now: number): number | undefined {
  return session.startTime === undefined ? undefined : Math.max(0, (session.endTime ?? now) - session.startTime)
}

export type AgentSpawn ={ id: string; type: string; description: string; model?: string; at: number }

export function spawnAgent(agents: readonly AgentRecord[], spawn: AgentSpawn): AgentRecord[] {
  const record: AgentRecord = {
    id: spawn.id,
    type: spawn.type,
    description: spawn.description.slice(0, AGENT_DESCRIPTION_LIMIT),
    status: 'running',
    startedAt: spawn.at,
    turns: 0,
    toolCalls: 0,
    tools: [],
  }
  if (spawn.model) record.model = spawn.model
  return [...agents.filter(agent => agent.id !== spawn.id), record]
}

export function agentTurn(agents: readonly AgentRecord[], id: string): AgentRecord[] {
  return mapAgent(agents, id, agent => ({ ...agent, status: 'running', turns: agent.turns + 1 }))
}

export function agentToolCall(agents: readonly AgentRecord[], id: string, tool: string): AgentRecord[] {
  return mapAgent(agents, id, agent => ({
    ...agent,
    toolCalls: agent.toolCalls + 1,
    tools: agent.tools.includes(tool) ? agent.tools : [...agent.tools, tool],
  }))
}

export function finishAgent(
  agents: readonly AgentRecord[],
  id: string,
  finish: { status: string; at: number; durationMs?: number },
): AgentRecord[] {
  return mapAgent(agents, id, agent => {
    const done: AgentRecord = { ...agent, status: finish.status, endedAt: finish.at }
    if (Number.isFinite(finish.durationMs)) done.durationMs = finish.durationMs
    return done
  })
}

// An agent the inspector never saw spawn is left alone, never invented.
function mapAgent(
  agents: readonly AgentRecord[],
  id: string,
  change: (agent: AgentRecord) => AgentRecord,
): AgentRecord[] {
  return agents.map(agent => (agent.id === id ? change(agent) : agent))
}

const ACTIVE_STATUS = new Set(['pending', 'running', 'waiting'])

// Subagents working now: started and not yet finished, failed or stopped.
export function activeAgents(agents: readonly AgentRecord[]): number {
  return agents.filter(agent => ACTIVE_STATUS.has(agent.status)).length
}

// Takes each known agent's status from the engine's live list; agents the list no longer has keep theirs.
export function syncAgentStatuses(agents: readonly AgentRecord[], live: readonly { id: string; status: string }[]): AgentRecord[] {
  const statuses = new Map(live.map(agent => [agent.id, agent.status]))
  return agents.map(agent => {
    const status = statuses.get(agent.id)
    return status === undefined || status === agent.status ? agent : { ...agent, status }
  })
}

const REASON_STATUS: Record<string, string> = {
  answer: 'completed',
  aborted: 'aborted',
  refusal: 'failed',
  error: 'failed',
}

export function agentStatusFromReason(reason: string): string {
  return REASON_STATUS[reason] ?? 'completed'
}
