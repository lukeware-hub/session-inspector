import { describe, expect, test } from 'claude-code/testing'

import {
  activeLoopAlert,
  addCall,
  addLoopAlert,
  addTurnTokens,
  callSignature,
  compactionLimit,
  detectLoop,
  estimateTokens,
  fingerprint,
  forecastTurns,
  recordLargest,
} from '../src/domain/insights'
import { EMPTY_LOOP, EMPTY_PRESSURE, type CallSignature } from '../src/domain/models'

describe('context forecast', () => {
  test('the limit is the compaction threshold when auto-compaction runs, else the window', () => {
    expect(compactionLimit({ turnTokens: [], isAutoCompact: true, threshold: 160_000 }, 200_000)).toBe(160_000)
    expect(compactionLimit({ turnTokens: [], isAutoCompact: false, threshold: 160_000 }, 200_000)).toBe(200_000)
    expect(compactionLimit(EMPTY_PRESSURE, 200_000)).toBe(200_000)
  })

  test('turns left follow the average growth per turn', () => {
    expect(forecastTurns([40_000, 50_000, 60_000], 60_000, 100_000)).toEqual({ growthPerTurn: 10_000, turnsLeft: 4 })
  })

  test('growth starts over after a compaction (a drop)', () => {
    expect(forecastTurns([80_000, 90_000, 20_000, 25_000], 25_000, 100_000)).toEqual({ growthPerTurn: 5000, turnsLeft: 15 })
  })

  test('no forecast from one turn, none while the context shrinks, zero once past the limit', () => {
    expect(forecastTurns([50_000], 50_000, 100_000)).toEqual({})
    expect(forecastTurns([50_000, 50_000], 50_000, 100_000)).toEqual({ growthPerTurn: 0 })
    expect(forecastTurns([90_000, 99_000], 120_000, 100_000)).toEqual({ turnsLeft: 0 })
  })

  test('turn samples keep the last 12', () => {
    let pressure = EMPTY_PRESSURE
    for (let i = 0; i < 15; i++) pressure = addTurnTokens(pressure, i)
    expect(pressure.turnTokens).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14])
  })
})

describe('context use', () => {
  test('tokens are estimated at four characters each', () => {
    expect(estimateTokens('x'.repeat(4000))).toBe(1000)
    expect(estimateTokens('abc')).toBe(1)
    expect(estimateTokens(undefined)).toBe(0)
  })

  test('the ten largest results are kept, biggest first', () => {
    let results = recordLargest([], { tool: 'Read', target: 'a.ts', tokens: 5, at: 1 })
    for (let i = 1; i <= 12; i++) results = recordLargest(results, { tool: 'Bash', tokens: i * 100, at: i })
    expect(results.length).toBe(10)
    expect(results[0]?.tokens).toBe(1200)
    expect(results.some(result => result.target === 'a.ts')).toBe(false)
  })
})

describe('loop detection', () => {
  const call = (signature: string, at: number, failed = false): CallSignature => ({ signature, label: signature, at, failed })

  test('a signature ignores the engine keys and the order of arguments, and keeps no argument', () => {
    const a = callSignature('Bash', { tool: 'Bash', command: 'npm test', timeout: 5, tool_use_id: 'x1' }, undefined)
    const b = callSignature('Bash', { timeout: 5, command: 'npm test', tool: 'Bash', tool_use_id: 'x2', agentId: 'a' }, undefined)
    expect(a).toEqual(b)
    expect(a.label).toBe('Bash')
    expect(a.signature).not.toContain('npm')
    expect(callSignature('Edit', { file_path: '/w/a.ts' }, 'a.ts').label).toBe('Edit a.ts')
    expect(fingerprint('a')).not.toBe(fingerprint('b'))
  })

  test('the fourth repeat within three minutes raises one alert', () => {
    let loop = EMPTY_LOOP
    const alerts: (string | undefined)[] = []
    for (let i = 0; i < 6; i++) {
      loop = addCall(loop, call('Edit a.ts', i * 30_000))
      alerts.push(detectLoop(loop.recent))
    }
    expect(alerts).toEqual([undefined, undefined, undefined, 'Edit a.ts repeated 4× in 2 min', undefined, undefined])
  })

  test('repeats spread past the window do not alert', () => {
    let loop = EMPTY_LOOP
    for (let i = 0; i < 4; i++) loop = addCall(loop, call('Read', i * 120_000))
    expect(detectLoop(loop.recent)).toBeUndefined()
  })

  test('three failures in a row raise one alert', () => {
    let loop = EMPTY_LOOP
    const alerts: (string | undefined)[] = []
    for (const [index, failed] of [false, true, true, true, true].entries()) {
      loop = addCall(loop, call(`c${index}`, index, failed))
      alerts.push(detectLoop(loop.recent))
    }
    expect(alerts).toEqual([undefined, undefined, undefined, '3 tool calls failed in a row', undefined])
  })

  test('an alert stays active for three minutes', () => {
    const loop = addLoopAlert(EMPTY_LOOP, 1000, 'Read repeated 4× in 1 min')
    expect(activeLoopAlert(loop, 1000 + 60_000)).toBe('Read repeated 4× in 1 min')
    expect(activeLoopAlert(loop, 1000 + 200_000)).toBeUndefined()
    expect(activeLoopAlert(EMPTY_LOOP, 0)).toBeUndefined()
  })
})
