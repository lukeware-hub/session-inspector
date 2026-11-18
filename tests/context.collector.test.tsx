import { expect, test } from 'claude-code/testing'

import { toReading } from '../src/collectors/context.collector'
import { PANE, stubEngine } from './engine-stubs'

const measure = (tokens: number | undefined, changed: ('context' | 'cost')[] = ['context']) => ({
  context: { tokens, window: 200_000 },
  rateLimits: [],
  changed,
})

test('a reading needs tokens; the percent is computed when the engine leaves it out', () => {
  expect(toReading({ window: 200_000 }, 1)).toBeUndefined()
  expect(toReading({ tokens: 50_000, window: 200_000 }, 1)).toEqual({ tokens: 50_000, window: 200_000, percent: 25, timestamp: 1 })
  expect(toReading({ tokens: 50_000, window: 200_000, percent: 26 }, 1)?.percent).toBe(26)
  expect(toReading({ tokens: 10, window: 0 }, 1)).toBeUndefined()
})

test('measurements build the context history and the pane shows them', async ($, on) => {
  stubEngine(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.session.measure(measure(40_000))
  await $.session.measure(measure(40_000))
  await $.session.measure(measure(90_000, ['cost']))
  await $.session.measure(measure(150_000))

  await $.command.run({ command: 'inspector', args: 'context', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } })
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await pane.find({ type: 'Text', text: /Attention/ })).toBeTruthy()
  expect(await pane.find({ type: 'Text', text: /^150k$/ })).toBeTruthy()
  expect(await pane.find({ type: 'Text', text: /^50k$/ })).toBeTruthy()
  expect(await pane.find({ type: 'Text', text: /▂▇/ })).toBeTruthy()
  await pane.unmount()
})

test('rising into High and Critical raises one alert each', async ($, on) => {
  const { toasts } = stubEngine(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  for (const tokens of [100_000, 172_000, 175_000, 192_000, 194_000]) await $.session.measure(measure(tokens))
  expect(toasts).toEqual(['Context High: 86% of the window used', 'Context Critical: 96% of the window used'])
})

test('a session with a reading at start shows it at once', async ($, on) => {
  stubEngine(on, { id: 'session-test-1', tokens: 30_000 })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'inspector', args: 'context', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } })
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await pane.find({ type: 'Text', text: /^Normal$/ })).toBeTruthy()
  await pane.unmount()
})
