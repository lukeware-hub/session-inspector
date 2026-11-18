import type { WifiRecord } from './models'

export type WifiCounters = { receivedBytes: number; sentBytes: number }

type Platform = 'macos' | 'windows' | 'wsl' | 'linux' | 'unknown' | undefined

// Each command prints one "receivedBytes sentBytes" line per Wi-Fi adapter that is up, and nothing when none is.
const WINDOWS_WIFI_COMMAND = [
  'powershell.exe',
  '-NoProfile',
  '-NonInteractive',
  '-Command',
  "[System.Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces() | Where-Object { $_.NetworkInterfaceType -eq 'Wireless80211' -and $_.OperationalStatus -eq 'Up' } | ForEach-Object { $s = $_.GetIPStatistics(); '{0} {1}' -f $s.BytesReceived, $s.BytesSent }",
] as const

const LINUX_WIFI_COMMAND = [
  '/bin/sh',
  '-c',
  'for d in /sys/class/net/*; do if { [ -e "$d/wireless" ] || [ -e "$d/phy80211" ]; } && [ "$(cat "$d/operstate")" = up ]; then echo "$(cat "$d/statistics/rx_bytes") $(cat "$d/statistics/tx_bytes")"; fi; done',
] as const

const MACOS_WIFI_COMMAND = [
  '/bin/sh',
  '-c',
  'dev=$(networksetup -listallhardwareports | awk \'/Wi-Fi|AirPort/ { getline; print $2; exit }\'); if [ -n "$dev" ]; then netstat -ibn -I "$dev" | awk \'$3 ~ /^<Link/ { print $7, $10; exit }\'; fi',
] as const

// The command for this platform; WSL reads the Windows host, whose adapter carries the Wi-Fi.
export function wifiCommand(platform: Platform): readonly string[] | undefined {
  if (platform === 'windows' || platform === 'wsl') return WINDOWS_WIFI_COMMAND
  if (platform === 'linux') return LINUX_WIFI_COMMAND
  if (platform === 'macos') return MACOS_WIFI_COMMAND
  return undefined
}

// Sums every adapter's line; undefined when no Wi-Fi adapter is up.
export function parseWifiCounters(output: string): WifiCounters | undefined {
  const rows = output
    .split(/\r?\n/)
    .map(line => line.trim().split(/\s+/).map(Number))
    .filter(fields => fields.length === 2 && fields.every(Number.isFinite))
  if (!rows.length) return undefined
  return rows.reduce((sum, [received = 0, sent = 0]) => ({ receivedBytes: sum.receivedBytes + received, sentBytes: sum.sentBytes + sent }), {
    receivedBytes: 0,
    sentBytes: 0,
  })
}

// Bytes per second between two counter readings; undefined when a counter went back, as after a reconnect.
function rate(previous: number | undefined, current: number, elapsedMs: number): number | undefined {
  if (previous === undefined || elapsedMs <= 0 || current < previous) return undefined
  return ((current - previous) / elapsedMs) * 1000
}

// A new reading: the rates cover the time since the previous one.
export function addWifiSample(previous: WifiRecord, counters: WifiCounters | undefined, at: number): WifiRecord {
  if (!counters) return { hasAdapter: false, sampledAt: at }
  const elapsed = previous.sampledAt === undefined ? 0 : at - previous.sampledAt
  return {
    hasAdapter: true,
    ...counters,
    sampledAt: at,
    downBytesPerSecond: rate(previous.receivedBytes, counters.receivedBytes, elapsed),
    upBytesPerSecond: rate(previous.sentBytes, counters.sentBytes, elapsed),
  }
}
