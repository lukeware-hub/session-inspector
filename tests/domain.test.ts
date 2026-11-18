import { describe, expect, test } from 'claude-code/testing'

import { bar, fit, formatDuration, formatPercent, formatTokens, sparkline } from '../src/domain/formatters'
import { contextLevel, contextPercent, isAlertRise } from '../src/domain/thresholds'
import { parseTab } from '../src/commands/inspector.command'
import { loadColor } from '../src/ui/components'

describe('context thresholds', () => {
  test('levels follow the bands 0-69, 70-84, 85-94, 95-100', () => {
    expect(contextLevel(0)).toBe('normal')
    expect(contextLevel(69)).toBe('normal')
    expect(contextLevel(70)).toBe('attention')
    expect(contextLevel(84)).toBe('attention')
    expect(contextLevel(85)).toBe('high')
    expect(contextLevel(94)).toBe('high')
    expect(contextLevel(95)).toBe('critical')
    expect(contextLevel(100)).toBe('critical')
  })

  test('percent is computed only from valid figures', () => {
    expect(contextPercent(50_000, 200_000)).toBe(25)
    expect(contextPercent(300_000, 200_000)).toBe(100)
    expect(contextPercent(undefined, 200_000)).toBeUndefined()
    expect(contextPercent(10, 0)).toBeUndefined()
    expect(contextPercent(-1, 100)).toBeUndefined()
    expect(contextPercent(Number.NaN, 100)).toBeUndefined()
  })

  test('an alert fires only when the level rises into High or Critical', () => {
    expect(isAlertRise(undefined, 'high')).toBe(true)
    expect(isAlertRise('attention', 'high')).toBe(true)
    expect(isAlertRise('high', 'critical')).toBe(true)
    expect(isAlertRise('high', 'high')).toBe(false)
    expect(isAlertRise('critical', 'high')).toBe(false)
    expect(isAlertRise('normal', 'attention')).toBe(false)
  })
})

describe('load colors', () => {
  test('CPU and limit bars are colored at every level, on the context scale', () => {
    expect([0, 16, 69, 70, 84, 85, 94, 95, 100].map(loadColor)).toEqual([
      'success', 'success', 'success', 'warning', 'warning', 'warning', 'warning', 'error', 'error',
    ])
  })
})

describe('formatting', () => {
  test('tokens', () => {
    expect(formatTokens(950)).toBe('950')
    expect(formatTokens(1234)).toBe('1.2k')
    expect(formatTokens(200_000)).toBe('200k')
    expect(formatTokens(1_500_000)).toBe('1.5M')
    expect(formatTokens(undefined)).toBe('—')
    expect(formatTokens(-5)).toBe('—')
  })

  test('durations', () => {
    expect(formatDuration(450)).toBe('450ms')
    expect(formatDuration(45_000)).toBe('45s')
    expect(formatDuration(125_000)).toBe('2m 05s')
    expect(formatDuration(3_720_000)).toBe('1h 02m')
    expect(formatDuration(undefined)).toBe('—')
    expect(formatDuration(Number.NaN)).toBe('—')
  })

  test('percent, bars, sparklines and fitting', () => {
    expect(formatPercent(42)).toBe('42%')
    expect(formatPercent(undefined)).toBe('—')
    expect(bar(50, 4)).toBe('██░░')
    expect(bar(150, 2)).toBe('██')
    expect(sparkline([0, 50, 100])).toBe('▁▅█')
    expect(fit('abcdef', 4)).toBe('abc…')
    expect(fit('abc', 4)).toBe('abc')
  })
})

describe('command arguments', () => {
  test('a section name opens that section', () => {
    expect(parseTab(' Tools ')).toBe('tools')
    expect(parseTab('')).toBeUndefined()
    expect(parseTab('nope')).toBeUndefined()
  })
})
