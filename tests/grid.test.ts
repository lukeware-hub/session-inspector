import { describe, expect, test } from 'claude-code/testing'

import { EMPTY_ACTIVITY, EMPTY_GIT, EMPTY_LOOP, EMPTY_PRESSURE, EMPTY_SESSION, EMPTY_SPEED, EMPTY_STATS, EMPTY_SYSTEM, type InspectorState } from '../src/domain/models'
import { BAND_LABEL_WIDTH, bandRows } from '../src/ui/above-prompt'
import { MAX_GAP, MIN_GAP, layoutGrid, meterText, type GridRow } from '../src/ui/components'

const text = (parts: { text: string }[]) => parts.map(part => part.text).join('')

// The column each line's n-th figure label starts at.
const starts = (line: string, labels: string[]) => labels.map(label => line.indexOf(label))

const STATE: InspectorState = {
  session: { ...EMPTY_SESSION, status: 'idle', startTime: 0 },
  contextReadings: [{ tokens: 538_000, window: 1_000_000, percent: 54, timestamp: 0 }],
  activity: EMPTY_ACTIVITY,
  stats: { ...EMPTY_STATS, totalTurns: 14, totalToolCalls: 151 },
  tools: [],
  agents: [],
  usage: { costUsd: 26.04, rateLimits: [{ kind: 'five_hour', percentUsed: 19 }, { kind: 'seven_day', percentUsed: 3 }] },
  files: [],
  git: { ...EMPTY_GIT, isRepo: true, added: 37, removed: 2, files: 2, checkedAt: 1 },
  speed: { ...EMPTY_SPEED, tokensPerSecond: 73 },
  system: { ...EMPTY_SYSTEM, cpuPercent: 6, memoryBytes: 708 * 1024 * 1024 },
  pressure: EMPTY_PRESSURE,
  results: [],
  loop: EMPTY_LOOP,
  tab: 'overview',
}

describe('band grid', () => {
  test('every column starts at the same cell in every row', () => {
    const lines = layoutGrid(bandRows(STATE, 5_640_000), 160, BAND_LABEL_WIDTH).map(text)
    const [context, session, system, limits] = lines
    expect(starts(context!, ['used', 'tokens', 'level'])).toEqual(starts(session!, ['time', 'subagents', 'turns']))
    expect(starts(system!, ['CPU', 'RAM', 'speed'])).toEqual(starts(session!, ['time', 'subagents', 'turns']))
    expect(starts(limits!, ['5h', '7d'])).toEqual(starts(session!, ['time', 'subagents']))
  })

  test('meters and their percentages line up across rows', () => {
    const lines = layoutGrid(bandRows(STATE, 0), 160, BAND_LABEL_WIDTH).map(text)
    const meterAt = (line: string) => line.search(/[█░]/)
    expect(new Set([lines[0], lines[2], lines[3]].map(line => meterAt(line!))).size).toBe(1)
    expect(meterText(6)).toBe('█░░░░░░░░░   6%')
    expect(meterText(54)).toBe('█████░░░░░  54%')
    expect(meterText(100)).toBe('██████████ 100%')
  })

  test('gaps widen with the room, up to the cap, and never shrink below three', () => {
    const rows: GridRow[] = [{ label: 'A', cells: [{ text: 'x' }, { text: 'y' }] }]
    const gapOf = (columns: number) => text(layoutGrid(rows, columns, 2)[0]!).indexOf('y') - 3
    expect(gapOf(7)).toBe(MIN_GAP)
    expect(gapOf(9)).toBe(MIN_GAP + 2)
    expect(gapOf(400)).toBe(MAX_GAP)
  })

  test('on a narrow band whole columns leave from the right, in every row alike', () => {
    const lines = layoutGrid(bandRows(STATE, 0), 70, BAND_LABEL_WIDTH).map(text)
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(70)
    expect(lines[1]).toContain('subagents')
    expect(lines[1]).not.toContain('lines')
    expect(lines[0]).not.toContain('forecast')
  })

  test('a missing value keeps its column with a dash, and a message spans its row', () => {
    const waiting = { ...STATE, contextReadings: [], usage: { rateLimits: [] }, git: EMPTY_GIT }
    const lines = layoutGrid(bandRows(waiting, 0), 160, BAND_LABEL_WIDTH).map(text)
    expect(lines[0]).toBe('Context  waiting for the first response')
    expect(lines[1]).toMatch(/cost\s+—\s+lines\s+—$/)
  })
})
