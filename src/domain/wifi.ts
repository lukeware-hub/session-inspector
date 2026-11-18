export type WifiLink = {
  ssid: string
  band?: string
  channel?: number
  signalPercent?: number
  rssi?: number
  receiveMbps?: number
  transmitMbps?: number
}

// Windows only: the Wi-Fi interfaces and their current link.
export const WIFI_COMMAND = ['netsh.exe', 'wlan', 'show', 'interfaces'] as const

// Each field by its label in English or Portuguese; only the ASCII start, as accents may arrive garbled.
const FIELDS: [RegExp, keyof WifiLink][] = [
  [/^ssid$/, 'ssid'],
  [/^banda?$/, 'band'],
  [/^(channel|canal)$/, 'channel'],
  [/^(signal|sinal)$/, 'signalPercent'],
  [/^rssi$/, 'rssi'],
  [/^(receive rate|taxa de recep)/, 'receiveMbps'],
  [/^(transmit rate|taxa de transmiss)/, 'transmitMbps'],
]

const TEXT_FIELDS: (keyof WifiLink)[] = ['ssid', 'band']

// The first connected interface in `netsh wlan show interfaces` output; undefined when none is connected.
export function parseWifiInterface(output: string): WifiLink | undefined {
  const link: Record<string, string | number> = {}
  for (const line of output.split(/\r?\n/)) {
    const [, label = '', raw = ''] = /^\s*(.+?)\s+:\s?(.*)$/.exec(line) ?? []
    const field = FIELDS.find(([pattern]) => pattern.test(label.toLowerCase()))?.[1]
    if (!field || field in link) continue
    const value = raw.trim()
    const number = parseFloat(value.replace(',', '.'))
    if (TEXT_FIELDS.includes(field)) link[field] = value
    else if (Number.isFinite(number)) link[field] = number
  }
  return link.ssid ? (link as WifiLink) : undefined
}
