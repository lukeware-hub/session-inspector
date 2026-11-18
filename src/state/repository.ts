import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import {
  EMPTY_ACTIVITY,
  EMPTY_GIT,
  EMPTY_LOOP,
  EMPTY_PRESSURE,
  EMPTY_SESSION,
  EMPTY_SPEED,
  EMPTY_STATS,
  EMPTY_SYSTEM,
  EMPTY_USAGE,
  type AgentRecord,
  type ContextReading,
  type FileRecord,
  type GitRecord,
  type LoopRecord,
  type PressureRecord,
  type ResultRecord,
  type InspectorState,
  type InspectorTab,
  type SessionMetrics,
  type SessionRecord,
  type SpeedRecord,
  type SystemRecord,
  type ToolMetrics,
  type UsageRecord,
} from '../domain/models'
import { appendEvent, type EventInput } from '../domain/reducers'

export type Engine = EngineInterface
type Change<T> = (value: T) => T

// The only file that reads or writes $.state: the engine's scan reads atoms only where they are used.
// Change a shape tag when that value's fields change: values an older version stored are then read as the initial.
const sessionState = atom({ plugin: 'session-inspector', key: 'session' } as const, EMPTY_SESSION, { shape: 'session-1' })
const contextState = atom({ plugin: 'session-inspector', key: 'context' } as const, [], { shape: 'context-1' })
const activityState = atom({ plugin: 'session-inspector', key: 'activity' } as const, EMPTY_ACTIVITY, { shape: 'activity-1' })
const statsState = atom({ plugin: 'session-inspector', key: 'stats' } as const, EMPTY_STATS, { shape: 'stats-2' })
const toolsState = atom({ plugin: 'session-inspector', key: 'tools' } as const, [], { shape: 'tools-3' })
const agentsState = atom({ plugin: 'session-inspector', key: 'agents' } as const, [], { shape: 'agents-1' })
const usageState = atom({ plugin: 'session-inspector', key: 'usage' } as const, EMPTY_USAGE, { shape: 'usage-1' })
const filesState = atom({ plugin: 'session-inspector', key: 'files' } as const, [], { shape: 'files-1' })
const gitState = atom({ plugin: 'session-inspector', key: 'git' } as const, EMPTY_GIT, { shape: 'git-1' })
const speedState = atom({ plugin: 'session-inspector', key: 'speed' } as const, EMPTY_SPEED, { shape: 'speed-1' })
const systemState = atom({ plugin: 'session-inspector', key: 'system' } as const, EMPTY_SYSTEM, { shape: 'system-1' })
const pressureState = atom({ plugin: 'session-inspector', key: 'pressure' } as const, EMPTY_PRESSURE, { shape: 'pressure-1' })
const resultsState = atom({ plugin: 'session-inspector', key: 'results' } as const, [], { shape: 'results-1' })
const loopState = atom({ plugin: 'session-inspector', key: 'loop' } as const, EMPTY_LOOP, { shape: 'loop-1' })
const tabState = atom({ plugin: 'session-inspector', key: 'tab' } as const, 'overview' as InspectorTab)

export async function readState($: Engine): Promise<InspectorState> {
  const [session, contextReadings, activity, stats, tools, agents, usage, files, git, speed, system, pressure, results, loop, tab] = await Promise.all([
    read($, sessionState),
    read($, contextState),
    read($, activityState),
    read($, statsState),
    read($, toolsState),
    read($, agentsState),
    read($, usageState),
    read($, filesState),
    read($, gitState),
    read($, speedState),
    read($, systemState),
    read($, pressureState),
    read($, resultsState),
    read($, loopState),
    read($, tabState),
  ])
  return { session, contextReadings, activity, stats, tools, agents, usage, files, git, speed, system, pressure, results, loop, tab }
}

export function readSession($: Engine): Promise<SessionRecord> {
  return read($, sessionState)
}

export function readContext($: Engine): Promise<ContextReading[]> {
  return read($, contextState)
}

export function changeSession($: Engine, change: Change<SessionRecord>): Promise<SessionRecord> {
  return update($, sessionState, change)
}

export function changeContext($: Engine, change: Change<ContextReading[]>): Promise<ContextReading[]> {
  return update($, contextState, change)
}

export function changeStats($: Engine, change: Change<SessionMetrics>): Promise<SessionMetrics> {
  return update($, statsState, change)
}

export function changeTools($: Engine, change: Change<ToolMetrics[]>): Promise<ToolMetrics[]> {
  return update($, toolsState, change)
}

export function changeAgents($: Engine, change: Change<AgentRecord[]>): Promise<AgentRecord[]> {
  return update($, agentsState, change)
}

export function changeUsage($: Engine, change: Change<UsageRecord>): Promise<UsageRecord> {
  return update($, usageState, change)
}

export function changeFiles($: Engine, change: Change<FileRecord[]>): Promise<FileRecord[]> {
  return update($, filesState, change)
}

export function readGit($: Engine): Promise<GitRecord> {
  return read($, gitState)
}

export function changeGit($: Engine, change: Change<GitRecord>): Promise<GitRecord> {
  return update($, gitState, change)
}

export function changeSpeed($: Engine, change: Change<SpeedRecord>): Promise<SpeedRecord> {
  return update($, speedState, change)
}

export function readSystem($: Engine): Promise<SystemRecord> {
  return read($, systemState)
}

export function changeSystem($: Engine, change: Change<SystemRecord>): Promise<SystemRecord> {
  return update($, systemState, change)
}

export function changePressure($: Engine, change: Change<PressureRecord>): Promise<PressureRecord> {
  return update($, pressureState, change)
}

export function changeResults($: Engine, change: Change<ResultRecord[]>): Promise<ResultRecord[]> {
  return update($, resultsState, change)
}

export function changeLoop($: Engine, change: Change<LoopRecord>): Promise<LoopRecord> {
  return update($, loopState, change)
}

export function setTab($: Engine, tab: InspectorTab): Promise<InspectorTab> {
  return update($, tabState, () => tab)
}

export async function logEvent($: Engine, input: EventInput): Promise<void> {
  await update($, activityState, log => appendEvent(log, input))
}

// Starts every session value over, for a new session id; the open section stays.
export async function resetState($: Engine): Promise<void> {
  await Promise.all([
    update($, sessionState, () => EMPTY_SESSION),
    update($, contextState, () => []),
    update($, activityState, () => EMPTY_ACTIVITY),
    update($, statsState, () => EMPTY_STATS),
    update($, toolsState, () => []),
    update($, agentsState, () => []),
    update($, usageState, () => EMPTY_USAGE),
    update($, filesState, () => []),
    update($, gitState, () => EMPTY_GIT),
    update($, speedState, () => EMPTY_SPEED),
    update($, systemState, () => EMPTY_SYSTEM),
    update($, pressureState, () => EMPTY_PRESSURE),
    update($, resultsState, () => []),
    update($, loopState, () => EMPTY_LOOP),
  ])
}

export async function touchSession($: Engine, at: number): Promise<void> {
  await update($, sessionState, session => ({ ...session, lastActivity: at }))
}
