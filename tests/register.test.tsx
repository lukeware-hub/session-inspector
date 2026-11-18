import { expect, test } from 'claude-code/testing'

import { BAND, MODEL, PANE, SESSION_ID, SURFACES, stubEngine } from './engine-stubs'

test('session start registers /inspector and the band shows the session', async ($, on) => {
  const { commands } = stubEngine(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  expect(commands).toEqual(['inspector'])

  for (const surface of SURFACES) {
    const band = await $.ui.mount({ ...BAND, surface })
    expect(await band.find({ type: 'Text', text: /Inspector/ })).toBeTruthy()
    expect(await band.find({ type: 'Text', text: new RegExp(MODEL) })).toBeTruthy()
    expect(await band.find({ type: 'Text', text: /waiting for the first response/ })).toBeTruthy()
    await band.unmount()
  }
})

test('/inspector opens the pane on the named section', async ($, on) => {
  const { panes } = stubEngine(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const answer = await $.command.run({
    command: 'inspector',
    args: 'sessions',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 120 },
  })
  expect(answer.text).toBe('Session Inspector opened.')
  expect(panes).toEqual(['session-inspector'])

  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await pane.find({ type: 'Text', text: new RegExp(SESSION_ID) })).toBeTruthy()
  await pane.unmount()
})

test('a pane with no room says so', async ($, on) => {
  stubEngine(on, { id: 'session-test-1', isPlaced: false })
  const answer = await $.command.run({
    command: 'inspector',
    args: '',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 60 },
  })
  expect(answer.text).toMatch(/waiting for room/)
})

test('tabs switch by press on every surface', async ($, on) => {
  stubEngine(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  for (const surface of SURFACES) {
    const pane = await $.ui.mount({ ...PANE, surface })
    await pane.press({ key: 'tab-tools' })
    expect(await pane.find({ type: 'Text', text: /No tool calls yet/ })).toBeTruthy()
    await pane.press({ key: 'tab-overview' })
    expect(await pane.find({ type: 'Text', text: /Session status/ })).toBeTruthy()
    await pane.unmount()
  }
})
