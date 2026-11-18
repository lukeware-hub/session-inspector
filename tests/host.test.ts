import { describe, expect, test } from 'claude-code/testing'

import {
  addSystemSample,
  claudeTreeUsage,
  parseCpuTime,
  parseNumstat,
  parseUnixTable,
  parseWindowsTable,
} from '../src/domain/host'
import { EMPTY_SYSTEM } from '../src/domain/models'
import { formatBytes, formatUsd, limitLabel, relativePath } from '../src/domain/formatters'

const WINDOWS = [
  '900',
  '0 0 8192 10000 System Idle Process',
  '100 1 1048576 20000000 explorer.exe',
  '200 100 104857600 30000000 claude.exe',
  '210 200 52428800 10000000 claude.exe',
  '220 210 10485760 5000000 node.exe',
  '900 210 4194304 1000000 powershell.exe',
  '300 100 999999999 99999999 other.exe',
].join('\r\n')

describe('process tables', () => {
  test('Windows rows convert bytes and 100-nanosecond CPU time', () => {
    const table = parseWindowsTable(WINDOWS)
    expect(table?.selfPid).toBe(900)
    expect(table?.rows.find(row => row.pid === 0)?.name).toBe('System Idle Process')
    expect(table?.rows.find(row => row.pid === 200)).toEqual({ pid: 200, ppid: 100, memoryBytes: 104857600, cpuMs: 3000, name: 'claude.exe' })
  })

  test('the Claude tree starts at the topmost Claude process and leaves out the sampler', () => {
    const table = parseWindowsTable(WINDOWS)
    expect(table && claudeTreeUsage(table)).toEqual({ memoryBytes: 104857600 + 52428800 + 10485760, cpuTimeMs: 3000 + 1000 + 500, processes: 3 })
  })

  test('no Claude ancestor means no figure', () => {
    expect(claudeTreeUsage({ selfPid: 5, rows: [{ pid: 5, ppid: 1, memoryBytes: 1, cpuMs: 1, name: 'sh' }] })).toBeUndefined()
  })

  test('Unix rows convert KiB and cputime', () => {
    const table = parseUnixTable(['42', '  10     1  2048 01:02:03 claude', '42 10 100 00:00 sh'].join('\n'))
    expect(table?.rows[0]).toEqual({ pid: 10, ppid: 1, memoryBytes: 2048 * 1024, cpuMs: 3_723_000, name: 'claude' })
    expect(table && claudeTreeUsage(table)?.processes).toBe(1)
  })

  test('cputime with days, and garbage input', () => {
    expect(parseCpuTime('1-00:00:01')).toBe(86_401_000)
    expect(parseCpuTime('00:05')).toBe(5000)
    expect(parseWindowsTable('not a pid')).toBeUndefined()
    expect(parseUnixTable('7\nbroken row')?.rows).toEqual([])
  })
})

describe('system samples', () => {
  test('CPU is the share of one core between two samples', () => {
    const first = addSystemSample(EMPTY_SYSTEM, { memoryBytes: 100, cpuTimeMs: 1000, processes: 2 }, 10_000)
    expect(first.cpuPercent).toBeUndefined()
    const second = addSystemSample(first, { memoryBytes: 200, cpuTimeMs: 6000, processes: 2 }, 20_000)
    expect(second.cpuPercent).toBe(50)
    expect(second.cpuHistory).toEqual([50])
    expect(second.memoryBytes).toBe(200)
  })

  test('a process that restarted (less CPU time) gives no CPU figure', () => {
    const first = addSystemSample(EMPTY_SYSTEM, { memoryBytes: 1, cpuTimeMs: 9000, processes: 1 }, 0)
    expect(addSystemSample(first, { memoryBytes: 1, cpuTimeMs: 10, processes: 1 }, 10_000).cpuPercent).toBeUndefined()
  })
})

describe('git and formatting', () => {
  test('numstat sums lines and counts binary files', () => {
    expect(parseNumstat('10\t2\ta.ts\n-\t-\timage.png\n3\t0\tdir/b.ts\n')).toEqual({ added: 13, removed: 2, files: 3 })
    expect(parseNumstat('')).toEqual({ added: 0, removed: 0, files: 0 })
  })

  test('bytes, dollars, limits and paths', () => {
    expect(formatBytes(536_870_912)).toBe('512 MB')
    expect(formatBytes(1_610_612_736)).toBe('1.5 GB')
    expect(formatBytes(undefined)).toBe('—')
    expect(formatUsd(8.4)).toBe('$8.40')
    expect(formatUsd(undefined)).toBe('—')
    expect(limitLabel('five_hour')).toBe('5h')
    expect(limitLabel('weekly_tokens')).toBe('weekly tokens')
    expect(relativePath('C:\\work\\app\\src\\a.ts', 'C:\\work\\app')).toBe('src/a.ts')
    expect(relativePath('/home/me/app/a.ts', '/home/me/app/')).toBe('a.ts')
    expect(relativePath('/etc/hosts', '/home/me/app')).toBe('/etc/hosts')
  })
})
