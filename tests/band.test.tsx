import { expect, test } from 'claude-code/testing'

import { bandLayout } from '../src/ui/above-prompt'
import { BAND, MODEL, PANE, USAGE, stubEngine } from './engine-stubs'

test('the frame needs five rows; below that the rows stay bare', () => {
  expect(bandLayout(8)).toEqual({ isFramed: true, rows: 4 })
  expect(bandLayout(5)).toEqual({ isFramed: true, rows: 2 })
  expect(bandLayout(4)).toEqual({ isFramed: false, rows: 4 })
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
    expect(lines).toContain('█████████░  90%')
    expect(lines).toContain('180k / 200k')
    expect(lines).toContain('High')
    expect(lines).toContain('$3.50')
    for (const label of ['used', 'tokens', 'level', 'time', 'turns', 'tools', 'cost', '5h']) expect(lines.map(text => text.trim())).toContain(label)
    expect(lines.map(text => text.trim())).toContain('Limits')
    expect(lines).toContain('██████████  97%')
    expect((await band.find({ type: 'Text', text: '██████████  97%' }))?.props.color).toBe('error')
    await band.unmount()
  }
})

test('the effort of the last main request is shown beside the model', async ($, on) => {
  stubEngine(on)
  on('turn.step', async function* (_, e) {
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn' as const, usage: null }
  })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  for await (const _ of $.turn.step({ turnId: 't1', index: 0, model: MODEL, effort: 'xhigh', messageCount: 1 })) {
    // No chunks.
  }
  for await (const _ of $.turn.step({ turnId: 't2', index: 0, model: MODEL, effort: 'low', messageCount: 1, agentId: 'sub-1' })) {
    // A subagent's effort does not replace the session's.
  }
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await band.findAll({ type: 'Text' })).map(found => found.text)).toContain('effort xhigh')
  await band.unmount()
})

test('CPU uses the same ten-cell scale as the context', async ($, on) => {
  // CPU time grows 5 s between two samples 10 s apart: half a core.
  const cpuTimes = ['00:00:02', '00:00:07']
  let sample = 0
  const { clock } = stubEngine(on, {
    id: 'session-test-1',
    // Only the process list answers; the Wi-Fi reading shares /bin/sh and must not use up a sample.
    host: { '/bin/sh': argv => (argv[2]?.includes('ps -A') ? `50\n10 1 524288 ${cpuTimes[Math.min(sample++, 1)]} claude\n50 10 100 00:00:00 sh\n` : '') },
  })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await clock.advance(10_000)
  await $.turn.start({ text: 'go', turnId: 't1' })
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const lines = (await band.findAll({ type: 'Text' })).map(found => found.text)
  expect(lines.map(text => text.trim())).toContain('CPU')
  expect(lines).toContain('█████░░░░░  50%')
  expect((await band.find({ type: 'Text', text: '█████░░░░░  50%' }))?.props.color).toBe('success')
  expect(lines.map(text => text.trim())).toContain('RAM')
  expect(lines).toContain('512 MB')
  await band.unmount()
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

test('the desktop band keeps every row and drops the optional figures when narrow', async ($, on) => {
  stubEngine(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.session.measure({ context: { tokens: 90_000, window: 1_000_000 }, cost: { usd: 1 }, rateLimits: [], changed: ['context', 'cost', 'rateLimits'] })
  const wide = await $.ui.mount({ ...BAND, props: { ...BAND.props, maxRows: 5, bodyColumns: 120 }, surface: 'desktop' })
  const wideTexts = (await wide.findAll({ type: 'Text' })).map(found => found.text.trim())
  for (const label of ['Context', 'Session', 'Limits', 'forecast', 'lines']) expect(wideTexts).toContain(label)
  await wide.unmount()
  const narrow = await $.ui.mount({ ...BAND, props: { ...BAND.props, maxRows: 5, bodyColumns: 50 }, surface: 'desktop' })
  const narrowTexts = (await narrow.findAll({ type: 'Text' })).map(found => found.text.trim())
  for (const label of ['Context', 'Limits', 'time', 'cost']) expect(narrowTexts).toContain(label)
  for (const label of ['forecast', 'lines']) expect(narrowTexts).not.toContain(label)
  await narrow.unmount()
})

test('cards: a tall terminal and the desktop draw bordered cards, a short terminal keeps the text grid', async ($, on) => {
  stubEngine(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.session.measure({ context: { tokens: 90_000, window: 1_000_000 }, cost: { usd: 1 }, rateLimits: [], changed: ['context', 'cost', 'rateLimits'] })
  const count = async (surface: 'terminal' | 'desktop', maxRows: number, bodyColumns = 140) => {
    const band = await $.ui.mount({ ...BAND, props: { ...BAND.props, maxRows, bodyColumns }, surface })
    const cards = (await band.findAll({ type: 'Box' })).filter(found => found.props.width === '25%')
    await band.unmount()
    return cards.length
  }
  expect(await count('terminal', 20)).toBeGreaterThanOrEqual(12)
  expect(await count('desktop', 5)).toBeGreaterThanOrEqual(12)
  expect(await count('terminal', 8)).toBe(0)
})

test('cards: every row holds the same number of slots, so the columns line up', async ($, on) => {
  stubEngine(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const band = await $.ui.mount({ ...BAND, props: { ...BAND.props, maxRows: 5, bodyColumns: 140 }, surface: 'desktop' })
  const widths = (await band.findAll({ type: 'Box' })).map(found => found.props.width).filter(width => width === '25%')
  expect(widths.length % 4).toBe(0)
  await band.unmount()
})
