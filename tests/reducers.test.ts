import { describe, expect, test } from 'claude-code/testing'

import { EMPTY_ACTIVITY, EMPTY_STATS } from '../src/domain/models'
import {
  addContextReading,
  addUsage,
  agentStatusFromReason,
  agentToolCall,
  agentTurn,
  appendEvent,
  countToolCall,
  countTurn,
  finishAgent,
  normalizeEvent,
  pushCapped,
  recordTool,
  recordCompaction,
  recordFile,
  finishTool,
  mcpGroups,
  mcpServer,
  slowestTools,
  tokensPerSecond,
  addSpeed,
  sessionDurationMs,
  spawnAgent,
  toolDistribution,
  totalTokens,
} from '../src/domain/reducers'

describe('history limits', () => {
  test('pushCapped keeps only the newest items', () => {
    expect(pushCapped([1, 2, 3], 4, 3)).toEqual([2, 3, 4])
    expect(pushCapped([], 1, 0)).toEqual([1])
  })

  test('the context history keeps 12 readings', () => {
    let readings = addContextReading([], { tokens: 0, window: 100, percent: 0, timestamp: 0 })
    for (let i = 1; i < 20; i++) readings = addContextReading(readings, { tokens: i, window: 100, percent: i, timestamp: i })
    expect(readings.length).toBe(12)
    expect(readings[0]?.tokens).toBe(8)
    expect(readings.at(-1)?.tokens).toBe(19)
  })

  test('the activity log keeps 50 events and numbers every one', () => {
    let log = EMPTY_ACTIVITY
    for (let i = 0; i < 60; i++) log = appendEvent(log, { type: 'tool.call', label: `call ${i}`, toolName: 'Bash' })
    expect(log.total).toBe(60)
    expect(log.items.length).toBe(50)
    expect(log.items[0]?.sequence).toBe(11)
    expect(log.items.at(-1)?.sequence).toBe(60)
  })
})

describe('event normalization', () => {
  test('drops empty optional fields and falls back to the type as label', () => {
    expect(normalizeEvent(3, { type: 'turn.start', label: '  ', toolName: '', agentId: undefined })).toEqual({
      sequence: 3,
      type: 'turn.start',
      label: 'turn.start',
    })
  })

  test('keeps a valid timestamp, tool and agent', () => {
    expect(normalizeEvent(1, { type: 'tool.call', label: 'Read', timestamp: 5, toolName: 'Read', agentId: 'a1' })).toEqual({
      sequence: 1,
      type: 'tool.call',
      label: 'Read',
      timestamp: 5,
      toolName: 'Read',
      agentId: 'a1',
    })
  })

  test('drops a timestamp that is not a number', () => {
    expect(normalizeEvent(1, { type: 'tool.call', label: 'x', timestamp: Number.NaN }).timestamp).toBeUndefined()
  })
})

describe('tool metrics', () => {
  test('counts executions per name and keeps the last time', () => {
    let tools = recordTool([], 'Bash', 1)
    tools = recordTool(tools, 'Read', 2)
    tools = recordTool(tools, 'Bash', 3)
    expect(tools).toEqual([
      { name: 'Bash', executions: 2, errors: 0, denials: 0, totalMs: 0, maxMs: 0, lastExecution: 3 },
      { name: 'Read', executions: 1, errors: 0, denials: 0, totalMs: 0, maxMs: 0, lastExecution: 2 },
    ])
  })

  test('a finished call adds its time and its outcome', () => {
    let tools = recordTool(recordTool([], 'Bash', 1), 'Bash', 2)
    tools = finishTool(tools, 'Bash', 300, 'ok')
    tools = finishTool(tools, 'Bash', 100, 'error')
    tools = finishTool(tools, 'Bash', Number.NaN, 'denied')
    expect(tools[0]).toEqual({ name: 'Bash', executions: 2, errors: 1, denials: 1, totalMs: 400, maxMs: 300, lastExecution: 2 })
    expect(finishTool([], 'Ghost', 5, 'error')).toEqual([])
  })

  test('slowest tools sort by average and skip untimed ones', () => {
    let tools = recordTool(recordTool(recordTool([], 'Read', 1), 'Bash', 1), 'Grep', 1)
    tools = finishTool(finishTool(tools, 'Read', 10, 'ok'), 'Bash', 900, 'ok')
    expect(slowestTools(tools).map(tool => [tool.name, tool.averageMs])).toEqual([['Bash', 900], ['Read', 10]])
  })

  test('MCP tools group by server', () => {
    expect(mcpServer('mcp__slack__send_message')).toBe('slack')
    expect(mcpServer('Bash')).toBeUndefined()
    let tools = recordTool([], 'mcp__slack__send_message', 1)
    tools = recordTool(recordTool(tools, 'mcp__slack__search', 2), 'mcp__slack__search', 3)
    tools = recordTool(recordTool(tools, 'mcp__notion__fetch', 4), 'Read', 5)
    expect(mcpGroups(tools)).toEqual([
      { server: 'slack', executions: 3, tools: ['send_message', 'search'] },
      { server: 'notion', executions: 1, tools: ['fetch'] },
    ])
  })

  test('distribution sorts by use and gives shares', () => {
    const tools = recordTool(recordTool(recordTool([], 'Read', 1), 'Bash', 2), 'Bash', 3)
    expect(toolDistribution(tools)).toEqual([
      { name: 'Bash', executions: 2, share: 2 / 3 },
      { name: 'Read', executions: 1, share: 1 / 3 },
    ])
    expect(toolDistribution([])).toEqual([])
  })
})

describe('session counters', () => {
  test('turns and tool calls', () => {
    const stats = countToolCall(countTurn(countTurn(EMPTY_STATS, false), true))
    expect(stats.totalTurns).toBe(1)
    expect(stats.totalSubagentTurns).toBe(1)
    expect(stats.totalToolCalls).toBe(1)
  })

  test('usage adds up and ignores missing or invalid figures', () => {
    const usage = { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 100, cache_creation_input_tokens: 20 }
    const stats = addUsage(addUsage(EMPTY_STATS, usage), usage)
    expect(totalTokens(stats)).toBe(270)
    expect(addUsage(EMPTY_STATS, undefined)).toBe(EMPTY_STATS)
    const bad = { input_tokens: Number.NaN, output_tokens: -4, cache_read_input_tokens: 1, cache_creation_input_tokens: 0 }
    expect(totalTokens(addUsage(EMPTY_STATS, bad))).toBe(1)
  })

  test('session duration runs to the end time when the session ended', () => {
    expect(sessionDurationMs({ status: 'idle' }, 10)).toBeUndefined()
    expect(sessionDurationMs({ status: 'running', startTime: 1000 }, 4000)).toBe(3000)
    expect(sessionDurationMs({ status: 'ended', startTime: 1000, endTime: 2000 }, 9000)).toBe(1000)
  })
})

describe('files, compaction and speed', () => {
  test('files count reads and edits and keep the 40 most recent', () => {
    let files = recordFile([], 'a.ts', 'read', 1)
    files = recordFile(files, 'a.ts', 'edit', 2)
    expect(files).toEqual([{ path: 'a.ts', reads: 1, edits: 1, lastAt: 2 }])
    for (let i = 0; i < 45; i++) files = recordFile(files, `f${i}.ts`, 'read', 10 + i)
    expect(files.length).toBe(40)
    expect(files.some(file => file.path === 'a.ts')).toBe(false)
  })

  test('a compaction is counted with its trigger', () => {
    const stats = recordCompaction(recordCompaction(EMPTY_STATS, 5, 'auto'), 9, 'manual')
    expect(stats.compactions).toBe(2)
    expect(stats.lastCompaction).toEqual({ at: 9, trigger: 'manual' })
  })

  test('speed is output tokens per second, and unmeasurable without both figures', () => {
    expect(tokensPerSecond(500, 2000)).toBe(250)
    expect(tokensPerSecond(undefined, 2000)).toBeUndefined()
    expect(tokensPerSecond(10, 0)).toBeUndefined()
    let speed: { tokensPerSecond?: number; history: number[] } = { history: [] }
    for (let i = 1; i <= 14; i++) speed = addSpeed(speed, i)
    expect(speed.tokensPerSecond).toBe(14)
    expect(speed.history.length).toBe(12)
  })
})

describe('agents', () => {
  test('a spawned agent gets turns, tools and a finish', () => {
    let agents = spawnAgent([], { id: 'a1', type: 'Explore', description: 'x'.repeat(100), model: 'haiku', at: 10 })
    agents = agentTurn(agents, 'a1')
    agents = agentToolCall(agents, 'a1', 'Grep')
    agents = agentToolCall(agents, 'a1', 'Grep')
    agents = finishAgent(agents, 'a1', { status: 'completed', at: 50, durationMs: 40 })
    expect(agents[0]).toEqual({
      id: 'a1',
      type: 'Explore',
      description: 'x'.repeat(60),
      model: 'haiku',
      status: 'completed',
      startedAt: 10,
      endedAt: 50,
      durationMs: 40,
      turns: 1,
      toolCalls: 2,
      tools: ['Grep'],
    })
  })

  test('an agent never seen is not invented', () => {
    expect(agentTurn([], 'ghost')).toEqual([])
    expect(finishAgent([], 'ghost', { status: 'completed', at: 1 })).toEqual([])
  })

  test('a turn reason maps to a status', () => {
    expect(agentStatusFromReason('answer')).toBe('completed')
    expect(agentStatusFromReason('error')).toBe('failed')
    expect(agentStatusFromReason('aborted')).toBe('aborted')
  })
})
