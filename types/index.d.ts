// The state contract of Session Inspector: every value it keeps in $.state.

export type ContextLevel = 'normal' | 'attention' | 'high' | 'critical'

export type ContextReading = {
  tokens: number
  window: number
  percent: number
  timestamp: number
}

export type SessionStatus = 'idle' | 'running' | 'ended'

export type SessionRecord = {
  id?: string
  model?: string
  status: SessionStatus
  startTime?: number
  endTime?: number
  endReason?: string
  lastActivity?: number
}

export type SessionMetrics = {
  totalTurns: number
  totalToolCalls: number
  totalSubagentTurns: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheCreationTokens: number
  compactions: number
  lastCompaction?: { at: number; trigger: string }
}

export type InspectorEventType =
  | 'session.start'
  | 'session.end'
  | 'turn.start'
  | 'turn.complete'
  | 'tool.call'
  | 'tool.error'
  | 'agent.spawn'
  | 'agent.complete'
  | 'context.alert'
  | 'context.compact'
  | 'tool.denied'

export type InspectorEvent = {
  sequence: number
  type: InspectorEventType
  label: string
  timestamp?: number
  toolName?: string
  agentId?: string
}

export type ActivityLog = { total: number; items: InspectorEvent[] }

export type ToolMetrics = {
  name: string
  executions: number
  errors: number
  denials: number
  totalMs: number
  maxMs: number
  lastExecution: number
}

export type AgentRecord = {
  id: string
  type: string
  description: string
  model?: string
  status: string
  startedAt: number
  endedAt?: number
  durationMs?: number
  turns: number
  toolCalls: number
  tools: string[]
}

export type RateLimitRecord = { kind: string; percentUsed: number; resetsAt?: string }

export type UsageRecord = {
  costUsd?: number
  hasUnknownPrice?: boolean
  rateLimits: RateLimitRecord[]
}

export type FileRecord = { path: string; reads: number; edits: number; lastAt: number }

export type GitRecord = {
  isRepo: boolean
  baseRef?: string
  added: number
  removed: number
  files: number
  checkedAt?: number
}

export type SpeedRecord = {
  tokensPerSecond?: number
  history: number[]
}

export type SystemRecord = {
  memoryBytes?: number
  cpuPercent?: number
  cpuTimeMs?: number
  processes?: number
  sampledAt?: number
  cpuHistory: number[]
}

export type InspectorTab = 'overview' | 'context' | 'sessions' | 'activity' | 'tools' | 'agents' | 'files' | 'system'

declare module 'claude-code' {
  interface PluginState {
    'session-inspector': {
      session: Shaped<SessionRecord>
      context: Shaped<ContextReading[]>
      activity: Shaped<ActivityLog>
      stats: Shaped<SessionMetrics>
      tools: Shaped<ToolMetrics[]>
      agents: Shaped<AgentRecord[]>
      usage: Shaped<UsageRecord>
      files: Shaped<FileRecord[]>
      git: Shaped<GitRecord>
      speed: Shaped<SpeedRecord>
      system: Shaped<SystemRecord>
      tab: InspectorTab
    }
  }
}
