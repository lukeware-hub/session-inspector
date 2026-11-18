import { expect, test } from 'claude-code/testing'

import { BAND, PANE, SESSION_ID, stubEngine } from './engine-stubs'

// Answers the Wi-Fi command with the counters `bytes` holds now, and nothing else.
function wifiHost(bytes: { received: number; sent: number } | undefined) {
  return { '/bin/sh': (argv: readonly string[]) => (argv[2]?.includes('/sys/class/net') && bytes ? `${bytes.received} ${bytes.sent}\n` : '') }
}

async function texts(view: { findAll: (query: { type: 'Text' }) => Promise<{ text: string }[]> }): Promise<string[]> {
  return (await view.findAll({ type: 'Text' })).map(found => found.text)
}

test('the band shows Wi-Fi download and upload, read every five seconds', async ($, on) => {
  const bytes = { received: 0, sent: 0 }
  const { clock } = stubEngine(on, { id: SESSION_ID, host: wifiHost(bytes) })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await clock.settle()

  // 6,250,000 bytes in 5 seconds is 1,250,000 bytes/s, or 10000 Kbps.
  bytes.received = 6_250_000
  bytes.sent = 625_000
  await clock.advance(5000)
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await texts(band)).toContain('↓ 10000 Kbps')
  expect(await texts(band)).toContain(' ↑ 1000 Kbps')

  bytes.received += 1_250_000
  await clock.advance(5000)
  expect(await texts(band)).toContain('↓ 2000 Kbps')
  await band.unmount()

  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await pane.press({ key: 'tab-system' })
  expect(await texts(pane)).toContain('2000 Kbps')
  await pane.unmount()
})

test('with no Wi-Fi adapter up the band says off', async ($, on) => {
  const { clock } = stubEngine(on, { id: SESSION_ID, host: wifiHost(undefined) })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await clock.settle()
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await texts(band)).toContain('off')
  await band.unmount()
})
