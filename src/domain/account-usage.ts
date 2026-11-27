import type { RateLimitRecord } from './models'

// The account usage endpoint the /usage tab reads: the windows as they stand now, across every
// session and device of the account, not only what this session's last response reported.
export const ACCOUNT_USAGE_URL = 'https://api.anthropic.com/api/oauth/usage'
export const ACCOUNT_USAGE_HEADERS = { 'anthropic-beta': 'oauth-2025-04-20' }

const WINDOWS = ['five_hour', 'seven_day', 'seven_day_opus', 'seven_day_sonnet'] as const

type Window = { utilization?: unknown; resets_at?: unknown }

// The windows the answer reports, in a fixed order; undefined when it holds none or is not JSON.
export function parseAccountUsage(text: string): RateLimitRecord[] | undefined {
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(text) as Record<string, unknown>
  } catch {
    return undefined
  }
  if (!parsed || typeof parsed !== 'object') return undefined
  const limits = WINDOWS.flatMap(kind => {
    const window = parsed[kind] as Window | null | undefined
    if (!window || typeof window.utilization !== 'number' || !Number.isFinite(window.utilization)) return []
    const resetsAt = typeof window.resets_at === 'string' ? window.resets_at : undefined
    return [{ kind, percentUsed: window.utilization, ...(resetsAt ? { resetsAt } : {}) }]
  })
  return limits.length > 0 ? limits : undefined
}
