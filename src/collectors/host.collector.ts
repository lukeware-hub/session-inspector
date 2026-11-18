import {
  UNIX_PROCESS_COMMAND,
  WINDOWS_PROCESS_COMMAND,
  addSystemSample,
  claudeTreeUsage,
  parseNumstat,
  parseUnixTable,
  parseWindowsTable,
} from '../domain/host'
import type { Timer } from 'claude-code'

import { addWifiSample, parseWifiCounters, wifiCommand } from '../domain/wifi'
import { changeGit, changeSystem, changeWifi, readGit, readSystem, type Engine } from '../state/repository'

const SAMPLE_EVERY_MS = 10_000
const WIFI_EVERY_MS = 2_000
const COMMAND_TIMEOUT_MS = 10_000

// Runs a read-only host command; undefined when it cannot run or fails.
async function run($: Engine, argv: readonly string[]): Promise<string | undefined> {
  const done = await $.process.run(argv, { timeoutMs: COMMAND_TIMEOUT_MS })
  return done.exitCode === 0 ? done.stdout : undefined
}

// Remembers the commit the session started on, so line counts cover this session.
export async function captureGitBase($: Engine): Promise<void> {
  const repo = await $.session.repo()
  const head = repo ? (await run($, ['git', 'rev-parse', 'HEAD']))?.trim() : undefined
  await changeGit($, () => ({ isRepo: Boolean(repo), baseRef: head || undefined, added: 0, removed: 0, files: 0 }))
}

// Lines added and removed since the session's first commit, committed or not.
export async function refreshGit($: Engine): Promise<void> {
  const git = await readGit($)
  if (!git.isRepo || !git.baseRef) return
  const output = await run($, ['git', 'diff', '--numstat', git.baseRef])
  if (output === undefined) return
  const stat = parseNumstat(output)
  const at = await $.clock.now()
  await changeGit($, current => ({ ...current, ...stat, checkedAt: at }))
}

// CPU and memory of the Claude Code process tree, at most once every ten seconds.
export async function sampleSystem($: Engine): Promise<void> {
  const [previous, at, info] = await Promise.all([readSystem($), $.clock.now(), $.session.info()])
  if (previous.sampledAt !== undefined && at - previous.sampledAt < SAMPLE_EVERY_MS) return
  const isWindows = info.platform === 'windows'
  const output = await run($, isWindows ? WINDOWS_PROCESS_COMMAND : UNIX_PROCESS_COMMAND)
  const table = output === undefined ? undefined : isWindows ? parseWindowsTable(output) : parseUnixTable(output)
  const usage = table && claudeTreeUsage(table)
  if (usage) await changeSystem($, current => addSystemSample(current, usage, at))
}

let wifiTimer: Timer | undefined
let isReadingWifi = false

// Reads the Wi-Fi counters once; skipped while the previous reading still runs.
export async function sampleWifi($: Engine): Promise<void> {
  if (isReadingWifi) return
  isReadingWifi = true
  try {
    const command = wifiCommand((await $.session.info()).platform)
    const output = command && (await run($, command))
    if (output === undefined) return
    const at = await $.clock.now()
    await changeWifi($, previous => addWifiSample(previous, parseWifiCounters(output), at))
  } finally {
    isReadingWifi = false
  }
}

// Reads the Wi-Fi traffic now and every two seconds; a new session start replaces the timer.
export function startWifiSampler($: Engine): void {
  wifiTimer?.cancel()
  inBackground(sampleWifi($))
  wifiTimer = $.clock.every(WIFI_EVERY_MS, () => inBackground(sampleWifi($)))
}

// Host work runs beside the session and never holds up or breaks an event.
export function inBackground(work: Promise<void>): void {
  work.catch(() => undefined)
}
