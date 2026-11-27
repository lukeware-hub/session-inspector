import { SAMPLE_HISTORY_LIMIT, type SystemRecord } from './models'
import { pushCapped } from './reducers'

export type ProcessRow = { pid: number; ppid: number; memoryBytes: number; cpuMs: number; name: string }

export type ProcessTable = { selfPid: number; rows: ProcessRow[] }

export type TreeUsage = { memoryBytes: number; cpuTimeMs: number; processes: number }

// Windows: the sampling shell's own id, then one "pid ppid workingSetBytes cpu100ns name" row per process.
export const WINDOWS_PROCESS_COMMAND = [
  'powershell.exe',
  '-NoProfile',
  '-NonInteractive',
  '-Command',
  "$PID; Get-CimInstance Win32_Process | ForEach-Object { '{0} {1} {2} {3} {4}' -f $_.ProcessId, $_.ParentProcessId, [uint64]$_.WorkingSetSize, ([uint64]$_.KernelModeTime + [uint64]$_.UserModeTime), $_.Name }",
] as const

// macOS and Linux: the sampling shell's own id, then one "pid ppid rssKiB cputime name" row per process.
export const UNIX_PROCESS_COMMAND = ['/bin/sh', '-c', 'echo $$; ps -A -o pid=,ppid=,rss=,time=,comm='] as const

// "[[dd-]hh:]mm:ss" as milliseconds.
export function parseCpuTime(text: string): number {
  const [days, clock] = text.includes('-') ? text.split('-') : ['0', text]
  const parts = (clock ?? '').split(':').map(Number)
  const seconds = parts.reduce((total, part) => total * 60 + part, 0)
  return (Number(days) * 86_400 + seconds) * 1000
}

function parseTable(output: string, toRow: (fields: string[]) => ProcessRow | undefined): ProcessTable | undefined {
  const [first, ...lines] = output.trim().split(/\r?\n/)
  const selfPid = Number(first)
  if (!Number.isInteger(selfPid)) return undefined
  const rows = lines.map(line => toRow(line.trim().split(/\s+/))).filter((row): row is ProcessRow => row !== undefined)
  return { selfPid, rows }
}

function validRow(row: ProcessRow): ProcessRow | undefined {
  return [row.pid, row.ppid, row.memoryBytes, row.cpuMs].every(Number.isFinite) ? row : undefined
}

export function parseWindowsTable(output: string): ProcessTable | undefined {
  return parseTable(output, ([pid, ppid, bytes, cpu, ...name]) =>
    validRow({ pid: Number(pid), ppid: Number(ppid), memoryBytes: Number(bytes), cpuMs: Number(cpu) / 10_000, name: name.join(' ') }),
  )
}

export function parseUnixTable(output: string): ProcessTable | undefined {
  return parseTable(output, ([pid, ppid, kib, time, ...name]) =>
    validRow({ pid: Number(pid), ppid: Number(ppid), memoryBytes: Number(kib) * 1024, cpuMs: parseCpuTime(time ?? ''), name: name.join(' ') }),
  )
}

const CLAUDE_PROCESS = /claude/i

// Sums the Claude Code process tree the sampler runs under: the topmost Claude process above it and all its descendants.
export function claudeTreeUsage(table: ProcessTable): TreeUsage | undefined {
  const byPid = new Map(table.rows.map(row => [row.pid, row]))
  let root: ProcessRow | undefined
  let current = byPid.get(table.selfPid)
  for (let depth = 0; current && depth < 64; depth++) {
    if (CLAUDE_PROCESS.test(current.name)) root = current
    else if (root) break
    current = byPid.get(current.ppid)
  }
  if (!root) return undefined

  const tree = new Set([root.pid])
  for (let grew = true; grew; ) {
    grew = false
    for (const row of table.rows) {
      if (!tree.has(row.pid) && tree.has(row.ppid) && row.pid !== table.selfPid) {
        tree.add(row.pid)
        grew = true
      }
    }
  }
  const members = table.rows.filter(row => tree.has(row.pid))
  return {
    memoryBytes: members.reduce((sum, row) => sum + row.memoryBytes, 0),
    cpuTimeMs: members.reduce((sum, row) => sum + row.cpuMs, 0),
    processes: members.length,
  }
}

// A new sample; CPU is the share of one core used since the previous sample.
export function addSystemSample(previous: SystemRecord, usage: TreeUsage, at: number): SystemRecord {
  const elapsed = previous.sampledAt === undefined ? 0 : at - previous.sampledAt
  const spent = previous.cpuTimeMs === undefined ? 0 : usage.cpuTimeMs - previous.cpuTimeMs
  const cpuPercent = elapsed > 0 && spent >= 0 ? Math.round((spent / elapsed) * 100) : undefined
  return {
    memoryBytes: usage.memoryBytes,
    cpuTimeMs: usage.cpuTimeMs,
    processes: usage.processes,
    sampledAt: at,
    cpuPercent,
    cpuHistory: cpuPercent === undefined ? previous.cpuHistory : pushCapped(previous.cpuHistory, cpuPercent, SAMPLE_HISTORY_LIMIT),
  }
}

export type DiffStat = { added: number; removed: number; files: number }

// Sums `git diff --numstat` output; binary files count as changed files with no lines.
export function parseNumstat(output: string): DiffStat {
  return output
    .split(/\r?\n/)
    .map(line => line.split('\t'))
    .filter(fields => fields.length >= 3)
    .reduce(
      (stat, [added, removed]) => ({
        added: stat.added + (Number(added) || 0),
        removed: stat.removed + (Number(removed) || 0),
        files: stat.files + 1,
      }),
      { added: 0, removed: 0, files: 0 },
    )
}
