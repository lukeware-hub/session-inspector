import type { Timer } from 'claude-code'

import { ACCOUNT_USAGE_HEADERS, ACCOUNT_USAGE_URL, parseAccountUsage } from '../domain/account-usage'
import { changeUsage, type Engine } from '../state/repository'
import { inBackground } from './host.collector'

// Both readings refresh every ten seconds; a refused or failed account read keeps the last figures.
const ACCOUNT_USAGE_EVERY_MS = 10_000
const LIVE_USAGE_EVERY_MS = 10_000

let liveUsageTimer: Timer | undefined
let isReadingLiveUsage = false

// The session's cost as the engine totals it now. A measurement comes only with a model
// response, so other mods' model calls would otherwise wait for the next one to show.
export async function refreshLiveUsage($: Engine): Promise<void> {
  if (isReadingLiveUsage) return
  isReadingLiveUsage = true
  try {
    const { cost } = await $.session.usage()
    if (!cost) return
    await changeUsage($, current =>
      current.costUsd === cost.usd && current.hasUnknownPrice === cost.hasUnknownPrice
        ? current
        : { ...current, costUsd: cost.usd, hasUnknownPrice: cost.hasUnknownPrice },
    )
  } finally {
    isReadingLiveUsage = false
  }
}

// Reads the session's cost now and every ten seconds; a new session start replaces the timer.
export function startLiveUsagePoller($: Engine): void {
  liveUsageTimer?.cancel()
  inBackground(refreshLiveUsage($))
  liveUsageTimer = $.clock.every(LIVE_USAGE_EVERY_MS, () => inBackground(refreshLiveUsage($)))
}

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

// Reads the account usage now and every ten seconds; a new session start replaces the timer.
export function startAccountUsagePoller($: Engine): void {
  accountUsageTimer?.cancel()
  inBackground(refreshAccountUsage($))
  accountUsageTimer = $.clock.every(ACCOUNT_USAGE_EVERY_MS, () => inBackground(refreshAccountUsage($)))
}
