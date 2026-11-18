import type { HttpInit, On } from 'claude-code'

import { run } from '../collectors/host.collector'
import { megabitsPerSecond } from '../domain/network'
import { WIFI_COMMAND, parseWifiInterface, type WifiLink } from '../domain/wifi'
import type { Engine } from '../state/repository'

export const SPEED_TEST_TOOL = 'mcp__session-inspector__speed_test'
const SERVER = 'https://speed.cloudflare.com'
// Parallel transfers fill a fast link that a single one cannot.
const STREAMS = 8
// The host reads at most 4 MiB per request, so each stream repeats a smaller request.
const CHUNK_BYTES = 4_000_000
const DOWNLOAD_ROUNDS = 6
const UPLOAD_ROUNDS = 2

export async function registerSpeedTestTool($: Engine): Promise<void> {
  await $.tool.register({
    name: 'speed_test',
    description:
      "Measures this machine's internet download and upload speed in megabits per second, against speed.cloudflare.com, and on Windows reads the Wi-Fi link (network name, band, channel, signal, RSSI, link rates); wifi is null on cable or other systems. Takes about 10 to 30 seconds and moves about 260 MB.",
    inputSchema: { type: 'object', properties: {} },
  })
}

// One stream: the same request again and again, failing on the first error.
async function stream($: Engine, url: string, rounds: number, init?: HttpInit): Promise<void> {
  for (let round = 0; round < rounds; round++) {
    const response = await $.http.fetch(url, init)
    if (!response.ok) throw new Error(`HTTP ${response.status} from ${url}`)
  }
}

// Runs every stream at once and answers their combined speed.
async function measure($: Engine, url: string, rounds: number, init?: HttpInit): Promise<number> {
  const started = await $.clock.now()
  await Promise.all(Array.from({ length: STREAMS }, () => stream($, url, rounds, init)))
  const speed = megabitsPerSecond(CHUNK_BYTES * rounds * STREAMS, (await $.clock.now()) - started)
  if (speed === undefined) throw new Error('no time was measured')
  return speed
}

// The Wi-Fi link on Windows; null on cable, on other systems or when netsh fails.
async function readWifi($: Engine): Promise<WifiLink | null> {
  if ((await $.session.info()).platform !== 'windows') return null
  const output = await run($, WIFI_COMMAND)
  return (output !== undefined && parseWifiInterface(output)) || null
}

export function registerSpeedTestHandler(on: On): void {
  on('tool.run', { tool: SPEED_TEST_TOOL }, async $ => {
    try {
      const wifi = await readWifi($)
      const downloadMbps = await measure($, `${SERVER}/__down?bytes=${CHUNK_BYTES}`, DOWNLOAD_ROUNDS)
      const uploadMbps = await measure($, `${SERVER}/__up`, UPLOAD_ROUNDS, { method: 'POST', body: '0'.repeat(CHUNK_BYTES) })
      return { result: JSON.stringify({ downloadMbps, uploadMbps, wifi }) }
    } catch (error) {
      return { deny: `Speed test failed: ${error instanceof Error ? error.message : String(error)}` }
    }
  })
}
