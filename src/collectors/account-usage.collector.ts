import type { Timer } from 'claude-code'

import { ACCOUNT_USAGE_HEADERS, ACCOUNT_USAGE_URL, parseAccountUsage } from '../domain/account-usage'
import { changeUsage, type Engine } from '../state/repository'
import { inBackground } from './host.collector'

const ACCOUNT_USAGE_EVERY_MS = 60_000

let accountUsageTimer: Timer | undefined
let isReadingAccountUsage = false

// Reads the account's rate-limit windows as /usage shows them. Only a subscription sign-in
// (a bearer token) has them; an API key, a gateway or a refused request leaves the windows the
// responses reported in place.
export async function refreshAccountUsage($: Engine): Promise<void> {
  if (isReadingAccountUsage) return
  isReadingAccountUsage = true
  try {
    const authorization = await $.session.authorize()
    if (!authorization || authorization.kind !== 'bearer') return
    const response = await $.http.fetch(ACCOUNT_USAGE_URL, { headers: ACCOUNT_USAGE_HEADERS, auth: authorization.handle })
    const rateLimits = response.ok ? parseAccountUsage(response.text) : undefined
    if (rateLimits) await changeUsage($, current => ({ ...current, rateLimits }))
  } finally {
    isReadingAccountUsage = false
  }
}

// Reads the account usage now and every minute; a new session start replaces the timer.
export function startAccountUsagePoller($: Engine): void {
  accountUsageTimer?.cancel()
  inBackground(refreshAccountUsage($))
  accountUsageTimer = $.clock.every(ACCOUNT_USAGE_EVERY_MS, () => inBackground(refreshAccountUsage($)))
}
