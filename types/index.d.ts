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
  effort?: string
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
  | 'loop.alert'

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
  resultTokens: number
  lastExecution: number
}

// How fast the context grows, and where auto-compaction runs.
export type PressureRecord = {
  threshold?: number
  isAutoCompact?: boolean
  turnTokens: number[]
}

// One large tool result: which tool, on what file, and its estimated size.
export type ResultRecord = { tool: string; target?: string; tokens: number; at: number }

export type CallSignature = { signature: string; label: string; at: number; failed: boolean }

export type LoopAlert = { at: number; label: string }

export type LoopRecord = { recent: CallSignature[]; alerts: LoopAlert[] }

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
  // Lines the Edit and Write tools changed this session, as /usage counts them.
  linesAdded?: number
  linesRemoved?: number
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

// The computer's Wi-Fi traffic; `hasAdapter` is false when no Wi-Fi adapter is up.
export type WifiRecord = {
  hasAdapter?: boolean
  receivedBytes?: number
  sentBytes?: number
  sampledAt?: number
  downBytesPerSecond?: number
  upBytesPerSecond?: number
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
      wifi: Shaped<WifiRecord>
      pressure: Shaped<PressureRecord>
      results: Shaped<ResultRecord[]>
      loop: Shaped<LoopRecord>
      tab: InspectorTab
    }
  }
}
