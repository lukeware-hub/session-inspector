import type { ContextLevel } from './models'

const LEVELS: readonly { level: ContextLevel; from: number }[] = [
  { level: 'critical', from: 95 },
  { level: 'high', from: 85 },
  { level: 'attention', from: 70 },
  { level: 'normal', from: 0 },
]

const RANK: Record<ContextLevel, number> = { normal: 0, attention: 1, high: 2, critical: 3 }

const LABEL: Record<ContextLevel, string> = {
  normal: 'Normal',
  attention: 'Attention',
  high: 'High',
  critical: 'Critical',
}

// Whole percentage of the window in use, or undefined when it cannot be computed.
export function contextPercent(tokens: number | undefined, window: number | undefined): number | undefined {
  if (tokens === undefined || window === undefined) return undefined
  if (!Number.isFinite(tokens) || !Number.isFinite(window) || tokens < 0 || window <= 0) return undefined
  return Math.min(100, Math.round((tokens / window) * 100))
}

export function contextLevel(percent: number): ContextLevel {
  return LEVELS.find(entry => percent >= entry.from)?.level ?? 'normal'
}

export function levelLabel(level: ContextLevel): string {
  return LABEL[level]
}

// True when the level rose into High or Critical, the moments worth an alert.
export function isAlertRise(previous: ContextLevel | undefined, current: ContextLevel): boolean {
  return RANK[current] >= RANK.high && RANK[current] > RANK[previous ?? 'normal']
}
