import type {
  ActivityLog,
  AgentRecord,
  ContextReading,
  FileRecord,
  GitRecord,
  InspectorTab,
  SessionMetrics,
  SessionRecord,
  SpeedRecord,
  SystemRecord,
  ToolMetrics,
  UsageRecord,
} from '../../types'

export type {
  ActivityLog,
  AgentRecord,
  ContextLevel,
  ContextReading,
  FileRecord,
  GitRecord,
  InspectorEvent,
  InspectorEventType,
  InspectorTab,
  RateLimitRecord,
  SessionMetrics,
  SessionRecord,
  SessionStatus,
  SpeedRecord,
  SystemRecord,
  ToolMetrics,
  UsageRecord,
} from '../../types'

// Everything the inspector shows, read in one snapshot.
export type InspectorState = {
  session: SessionRecord
  contextReadings: ContextReading[]
  activity: ActivityLog
  stats: SessionMetrics
  tools: ToolMetrics[]
  agents: AgentRecord[]
  usage: UsageRecord
  files: FileRecord[]
  git: GitRecord
  speed: SpeedRecord
  system: SystemRecord
  tab: InspectorTab
}

export const CONTEXT_HISTORY_LIMIT = 12
export const ACTIVITY_LIMIT = 50
export const AGENT_DESCRIPTION_LIMIT = 60
export const FILES_LIMIT = 40
export const SAMPLE_HISTORY_LIMIT = 12

export const EMPTY_SESSION: SessionRecord = { status: 'idle' }

export const EMPTY_STATS: SessionMetrics = {
  totalTurns: 0,
  totalToolCalls: 0,
  totalSubagentTurns: 0,
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheCreationTokens: 0,
  compactions: 0,
}

export const EMPTY_ACTIVITY: ActivityLog = { total: 0, items: [] }
export const EMPTY_USAGE: UsageRecord = { rateLimits: [] }
export const EMPTY_GIT: GitRecord = { isRepo: false, added: 0, removed: 0, files: 0 }
export const EMPTY_SPEED: SpeedRecord = { history: [] }
export const EMPTY_SYSTEM: SystemRecord = { cpuHistory: [] }

export const TABS: readonly InspectorTab[] = [
  'overview',
  'context',
  'sessions',
  'activity',
  'tools',
  'agents',
  'files',
  'system',
]
