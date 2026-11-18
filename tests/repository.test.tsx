import { expect, test } from 'claude-code/testing'

import { PANE, stubEngine } from './engine-stubs'

test('a value an older version stored under another shape is read as empty', async ($, on) => {
  on('state.get', { key: 'tools' }, () => ({ value: { value: [{ tool: 'Bash', count: 'many' }], version: 1 } }))
  stubEngine(on)
  await $.command.run({ command: 'inspector', args: 'tools', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } })
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await pane.find({ type: 'Text', text: /No tool calls yet/ })).toBeTruthy()
  await pane.unmount()
})

test('a hot reload (session.start again in the same session) keeps the values', async ($, on) => {
  stubEngine(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'inspector', args: 'overview', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } })
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await pane.find({ type: 'Text', text: /^1$/ })).toBeTruthy()
  await pane.press({ key: 'tab-activity' })
  expect(await pane.find({ type: 'Text', text: /Session started/ })).toBeTruthy()
  expect((await pane.find({ type: 'Text', text: /#3 / }))).toBeFalsy()
  await pane.unmount()
})
