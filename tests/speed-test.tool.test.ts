import { expect, test } from 'claude-code/testing'

import { megabitsPerSecond } from '../src/domain/network'
import { parseWifiInterface } from '../src/domain/wifi'
import { SPEED_TEST_TOOL } from '../src/tools/speed-test.tool'
import { stubEngine } from './engine-stubs'

// Trimmed `netsh wlan show interfaces` output from a Windows in Portuguese.
const NETSH_PT = [
  'Há 1 interface no sistema: ',
  '',
  '    Nome                   : Wi-Fi',
  '    Estado                  : Conectado',
  '    SSID                   : MORAIS',
  '    AP BSSID               : 68:d4:0c:ab:1c:be',
  '    Banda                   : 5 GHz',
  '    Canal                : 116',
  '    Tipo de rádio             : 802.11ax',
  '    Taxa de recepção (Mbps)    : 865',
  '    Taxa de transmissão (Mbps)   : 721',
  '    Sinal                 : 83% ',
  '    Rssi                   : -60',
  '    Perfil                : MORAIS ',
].join('\r\n')

// The same fields with Windows' English labels.
const NETSH_EN = [
  'There is 1 interface on the system:',
  '',
  '    Name                   : Wi-Fi',
  '    State                  : connected',
  '    SSID                   : Home',
  '    BSSID                  : 68:d4:0c:ab:1c:be',
  '    Band                   : 2.4 GHz',
  '    Channel                : 6',
  '    Receive rate (Mbps)    : 286.8',
  '    Transmit rate (Mbps)   : 286.8',
  '    Signal                 : 99%',
  '    Rssi                   : -41',
].join('\r\n')

const OK = { value: { status: 200, ok: true, headers: {}, text: '' } }

test('megabits per second rounds and refuses zero time', () => {
  expect(megabitsPerSecond(25_000_000, 1000)).toBe(200)
  expect(megabitsPerSecond(1, 0)).toBeUndefined()
})

test('netsh output is read in Portuguese and English, and none when disconnected', () => {
  expect(parseWifiInterface(NETSH_PT)).toEqual({
    ssid: 'MORAIS', band: '5 GHz', channel: 116, signalPercent: 83, rssi: -60, receiveMbps: 865, transmitMbps: 721,
  })
  expect(parseWifiInterface(NETSH_EN)).toEqual({
    ssid: 'Home', band: '2.4 GHz', channel: 6, signalPercent: 99, rssi: -41, receiveMbps: 286.8, transmitMbps: 286.8,
  })
  expect(parseWifiInterface('    Name                   : Wi-Fi\r\n    State                  : disconnected')).toBeUndefined()
})

test('the speed test answers download, upload and the Wi-Fi link on Windows', async ($, on) => {
  const { clock } = stubEngine(on, { id: 'session-test-1', platform: 'windows', host: { 'netsh.exe': NETSH_PT } })
  const methods: string[] = []
  // Every download takes 100 ms and every upload 500 ms.
  on('http.fetch', async (_, e) => {
    methods.push(e.init?.method ?? 'GET')
    await clock.set(clock.now() + (e.init?.method === 'POST' ? 500 : 100))
    return OK
  })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const answer = await $.tool.call({ tool: SPEED_TEST_TOOL })
  expect(JSON.parse(String(answer.result))).toEqual({
    downloadMbps: 2560,
    uploadMbps: 512,
    wifi: { ssid: 'MORAIS', band: '5 GHz', channel: 116, signalPercent: 83, rssi: -60, receiveMbps: 865, transmitMbps: 721 },
  })
  expect(methods.filter(method => method === 'GET')).toHaveLength(48)
  expect(methods.filter(method => method === 'POST')).toHaveLength(16)
})

test('Wi-Fi is null off Windows', async ($, on) => {
  const { clock } = stubEngine(on)
  on('http.fetch', async () => {
    await clock.set(clock.now() + 100)
    return OK
  })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const answer = await $.tool.call({ tool: SPEED_TEST_TOOL })
  expect(JSON.parse(String(answer.result)).wifi).toBeNull()
})

test('a failed request ends the speed test with an error', async ($, on) => {
  stubEngine(on)
  on('http.fetch', () => ({ value: { status: 403, ok: false, headers: {}, text: '' } }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const answer = await $.tool.call({ tool: SPEED_TEST_TOOL })
  expect(answer.isError).toBe(true)
  expect(answer.text).toMatch(/Speed test failed: HTTP 403/)
})
