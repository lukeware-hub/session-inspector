const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE

// 950 -> "950", 1234 -> "1.2k", 200000 -> "200k", 1500000 -> "1.5M".
export function formatTokens(tokens: number | undefined): string {
  if (tokens === undefined || !Number.isFinite(tokens) || tokens < 0) return '—'
  if (tokens < 1000) return String(Math.round(tokens))
  if (tokens < 1_000_000) return `${trim(tokens / 1000)}k`
  return `${trim(tokens / 1_000_000)}M`
}

function trim(value: number): string {
  return value >= 100 ? String(Math.round(value)) : String(Number(value.toFixed(1)))
}

// 45000 -> "45s", 125000 -> "2m 05s", 3720000 -> "1h 02m".
export function formatDuration(ms: number | undefined): string {
  if (ms === undefined || !Number.isFinite(ms) || ms < 0) return '—'
  if (ms < SECOND) return `${Math.round(ms)}ms`
  if (ms < MINUTE) return `${Math.floor(ms / SECOND)}s`
  if (ms < HOUR) return `${Math.floor(ms / MINUTE)}m ${pad(Math.floor((ms % MINUTE) / SECOND))}s`
  return `${Math.floor(ms / HOUR)}h ${pad(Math.floor((ms % HOUR) / MINUTE))}m`
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

export function formatPercent(percent: number | undefined): string {
  return percent === undefined ? '—' : `${percent}%`
}

// Local time of day, "14:03:09".
export function formatClock(timestamp: number | undefined): string {
  if (timestamp === undefined) return '—'
  const date = new Date(timestamp)
  return [date.getHours(), date.getMinutes(), date.getSeconds()].map(pad).join(':')
}

// A text bar of `width` cells filled to `percent`.
export function bar(percent: number, width: number): string {
  const cells = Math.max(0, Math.floor(width))
  const filled = Math.round((Math.min(100, Math.max(0, percent)) / 100) * cells)
  return '█'.repeat(filled) + '░'.repeat(cells - filled)
}

// One block glyph per value, scaled to the 0-100 range.
export function sparkline(values: readonly number[]): string {
  const glyphs = '▁▂▃▄▅▆▇█'
  return values.map(value => glyphs[Math.min(7, Math.floor((Math.max(0, value) / 100) * 8))]).join('')
}

// Cuts a line to `columns`, ending it with an ellipsis when cut.
export function fit(text: string, columns: number): string {
  const room = Math.max(1, Math.floor(columns))
  return text.length <= room ? text : `${text.slice(0, room - 1)}…`
}

// 536870912 -> "512 MB", 1610612736 -> "1.5 GB".
export function formatBytes(bytes: number | undefined): string {
  if (bytes === undefined || !Number.isFinite(bytes) || bytes < 0) return '—'
  const mb = bytes / 1024 / 1024
  return mb < 1024 ? `${Math.round(mb)} MB` : `${trim(mb / 1024)} GB`
}

// Bytes per second in MB/s (1 MB = 1024 × 1024 bytes): 2516582 -> "2.4 MB/s", 157286400 -> "150 MB/s".
export function formatRate(bytesPerSecond: number | undefined): string {
  if (bytesPerSecond === undefined || !Number.isFinite(bytesPerSecond) || bytesPerSecond < 0) return '—'
  const mb = bytesPerSecond / 1024 / 1024
  return `${mb >= 100 ? Math.round(mb) : mb.toFixed(1)} MB/s`
}

// Dollars with cents, "$8.40"; an estimate the caller labels as such.
export function formatUsd(usd: number | undefined): string {
  return usd === undefined || !Number.isFinite(usd) ? '—' : `$${usd.toFixed(2)}`
}

const LIMIT_LABEL: Record<string, string> = { five_hour: '5h', seven_day: '7d', seven_day_opus: '7d Opus', spend_limit: 'spend' }

// A rate-limit window's short name: five_hour -> "5h".
export function limitLabel(kind: string): string {
  return LIMIT_LABEL[kind] ?? kind.replace(/_/g, ' ')
}

// A path under the working folder, written relative to it with forward slashes.
export function relativePath(path: string, cwd: string): string {
  const file = path.replace(/\\/g, '/')
  const base = cwd.replace(/\\/g, '/').replace(/\/$/, '')
  return file.toLowerCase().startsWith(`${base.toLowerCase()}/`) ? file.slice(base.length + 1) : file
}
