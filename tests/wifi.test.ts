import { describe, expect, test } from 'claude-code/testing'

import { formatRate } from '../src/domain/formatters'
import { EMPTY_WIFI } from '../src/domain/models'
import { addWifiSample, parseWifiCounters, wifiCommand } from '../src/domain/wifi'
import { wifiSegment } from '../src/ui/above-prompt'

const MB = 1024 * 1024

describe('wifi counters', () => {
  test('every adapter line is summed, and no line means no adapter', () => {
    expect(parseWifiCounters('100 20\r\n50 5\r\n')).toEqual({ receivedBytes: 150, sentBytes: 25 })
    expect(parseWifiCounters('')).toBeUndefined()
    expect(parseWifiCounters('not a number\n')).toBeUndefined()
  })

  test('each platform has its command; WSL reads the Windows host', () => {
    expect(wifiCommand('windows')?.[0]).toBe('powershell.exe')
    expect(wifiCommand('wsl')).toEqual(wifiCommand('windows'))
    expect(wifiCommand('linux')?.[0]).toBe('/bin/sh')
    expect(wifiCommand('macos')?.[2]).toContain('networksetup')
    expect(wifiCommand('unknown')).toBeUndefined()
  })
})

describe('wifi rates', () => {
  test('the first reading has no rate; the next one divides bytes by the time between them', () => {
    const first = addWifiSample(EMPTY_WIFI, { receivedBytes: 0, sentBytes: 0 }, 1000)
    expect(first.downBytesPerSecond).toBeUndefined()
    const next = addWifiSample(first, { receivedBytes: 4 * MB, sentBytes: MB }, 3000)
    expect(next.downBytesPerSecond).toBe(2 * MB)
    expect(next.upBytesPerSecond).toBe(MB / 2)
  })

  test('a counter that went back gives no rate, and no adapter turns the reading off', () => {
    const before = addWifiSample(EMPTY_WIFI, { receivedBytes: 500, sentBytes: 500 }, 1000)
    expect(addWifiSample(before, { receivedBytes: 10, sentBytes: 900 }, 3000).downBytesPerSecond).toBeUndefined()
    expect(addWifiSample(before, undefined, 3000)).toEqual({ hasAdapter: false, sampledAt: 3000 })
  })

  test('rates read in kilobits per second, 1 Kbps = 1000 bits/s', () => {
    expect(formatRate(21_375)).toBe('171 Kbps')
    expect(formatRate(0)).toBe('0 Kbps')
    expect(formatRate(12_500_000)).toBe('100000 Kbps')
    expect(formatRate(undefined)).toBe('—')
  })

  test('the band segment shows download and upload, off with no adapter, a dash before the second reading', () => {
    expect(wifiSegment({ hasAdapter: true, downBytesPerSecond: 21_375, upBytesPerSecond: 9_375 })).toEqual({
      label: 'wifi',
      text: '↓ 171 Kbps',
      more: [{ text: ' ↑ 75 Kbps' }],
      optional: true,
    })
    expect(wifiSegment({ hasAdapter: false })).toEqual({ label: 'wifi', text: 'off', dim: true, optional: true })
    expect(wifiSegment({ hasAdapter: true }).text).toBe('—')
  })
})
