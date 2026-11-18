import { expect, test } from 'claude-code/testing'

import { bandLayout } from '../src/ui/above-prompt'
import { BAND, MODEL, PANE, USAGE, stubEngine } from './engine-stubs'

test('the frame needs five rows; below that the rows stay bare', () => {
  expect(bandLayout(8)).toEqual({ isFramed: true, rows: 3 })
  expect(bandLayout(5)).toEqual({ isFramed: true, rows: 2 })
  expect(bandLayout(4)).toEqual({ isFramed: false, rows: 3 })
  expect(bandLayout(1)).toEqual({ isFramed: false, rows: 1 })
})

test('the framed band shows title, model, status and the three rows', async ($, on) => {
  stubEngine(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.session.measure({
    context: { tokens: 180_000, window: 200_000 },
    rateLimits: [{ kind: 'five_hour', percentUsed: 97 }],
    cost: { usd: 3.5 },
    changed: ['context', 'cost', 'rateLimits'],
  })
  for (const surface of ['terminal', 'desktop'] as const) {
    const band = await $.ui.mount({ ...BAND, surface })
    const lines = (await band.findAll({ type: 'Text' })).map(found => found.text)
    expect(lines).toContain('Session Inspector')
    expect(lines).toContain(MODEL)
    expect(lines).toContain('○ idle')
    expect(lines).toContain('▰▰▰▰▰▰▰▰▰▱ 90%')
    expect(lines).toContain('180k / 200k')
    expect(lines).toContain('High')
    expect(lines).toContain('$3.50')
    expect(lines).toContain('5h 97%')
    await band.unmount()
  }
})

test('a band without room drops the frame', async ($, on) => {
  stubEngine(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const band = await $.ui.mount({ ...BAND, props: { ...BAND.props, maxRows: 2 }, surface: 'terminal' })
  const lines = (await band.findAll({ type: 'Text' })).map(found => found.text)
  expect(lines).not.toContain('Session Inspector')
  expect(lines[0]).toBe('Context  ')
  expect(lines).not.toContain('System   ')
  await band.unmount()
})

test('a compaction is counted and logged', async ($, on) => {
  stubEngine(on)
  const summary = [{ role: 'user' as const, text: 'summary', toolUses: [] }]
  on('session.compact', () => ({ messages: summary }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.session.measure({ context: { tokens: 10_000, window: 200_000 }, rateLimits: [], changed: ['context'] })
  await $.session.compact({ trigger: 'auto', messages: [...summary, ...summary] })
  await $.command.run({ command: 'inspector', args: 'context', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } })
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await pane.find({ type: 'Text', text: /^1, last at \S+ \(auto\)$/ })).toBeTruthy()
  await pane.press({ key: 'tab-activity' })
  expect(await pane.find({ type: 'Text', text: /context\.compact\s+Context compacted \(auto\)/ })).toBeTruthy()
  await pane.unmount()
})

test('model speed is measured per request', async ($, on) => {
  const { clock } = stubEngine(on)
  on('turn.step', async function* (_, e) {
    await clock.advance(2000)
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn' as const, usage: USAGE }
  })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  for await (const _ of $.turn.step({ turnId: 't1', index: 0, model: MODEL, messageCount: 1 })) {
    // The stream carries no chunks here.
  }
  await $.command.run({ command: 'inspector', args: 'system', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } })
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await pane.find({ type: 'Text', text: /^250 tokens\/s$/ })).toBeTruthy()
  await pane.unmount()
})
