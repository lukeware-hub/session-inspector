import { expect, test } from 'claude-code/testing'

import { BAND, PANE, SESSION_ID, stubEngine } from './engine-stubs'

const MB = 1024 * 1024

// Answers the Wi-Fi command with the counters `bytes` holds now, and nothing else.
function wifiHost(bytes: { received: number; sent: number } | undefined) {
  return { '/bin/sh': (argv: readonly string[]) => (argv[2]?.includes('/sys/class/net') && bytes ? `${bytes.received} ${bytes.sent}\n` : '') }
}

async function texts(view: { findAll: (query: { type: 'Text' }) => Promise<{ text: string }[]> }): Promise<string[]> {
  return (await view.findAll({ type: 'Text' })).map(found => found.text)
}

test('the band shows Wi-Fi download and upload, read every two seconds', async ($, on) => {
  const bytes = { received: 0, sent: 0 }
  const { clock } = stubEngine(on, { id: SESSION_ID, host: wifiHost(bytes) })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await clock.settle()

  bytes.received = 6 * MB
  bytes.sent = MB
  await clock.advance(2000)
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await texts(band)).toContain('↓ 3.0 MB/s')
  expect(await texts(band)).toContain(' ↑ 0.5 MB/s')

  bytes.received += 2 * MB
  await clock.advance(2000)
  expect(await texts(band)).toContain('↓ 1.0 MB/s')
  await band.unmount()

  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await pane.press({ key: 'tab-system' })
  expect(await texts(pane)).toContain('1.0 MB/s')
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
