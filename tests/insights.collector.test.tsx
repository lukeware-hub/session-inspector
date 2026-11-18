import { expect, test } from 'claude-code/testing'

import { fixedCosts } from '../src/ui/inspector-pane'
import { BAND, PANE, USAGE, stubEngine } from './engine-stubs'

const open = (args: string) => ({
  command: 'inspector',
  args,
  origin: { kind: 'composer' as const },
  presentation: { isFullscreen: false, columns: 140 },
})

const complete = (turnId: string) => ({ answer: '', durationMs: 1000, isAborted: false, turnId, reason: 'answer' as const, usage: USAGE })

test('a repeated call raises a loop alert in a toast, the band and the activity', async ($, on) => {
  const { toasts, clock } = stubEngine(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  for (let i = 0; i < 4; i++) {
    await $.tool.call({ tool: 'Edit', file_path: '/work/app/src/a.ts', old_string: 'x', new_string: 'y' })
    await clock.advance(20_000)
  }
  expect(toasts).toEqual(['Possible loop: Edit src/a.ts repeated 4× in 1 min'])

  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const bandLines = (await band.findAll({ type: 'Text' })).map(found => found.text)
  expect(bandLines.map(text => text.trim())).toContain('Loop')
  expect(bandLines).toContain('Edit src/a.ts repeated 4× in 1 min')
  await band.unmount()

  await $.command.run(open('activity'))
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await pane.find({ type: 'Text', text: /loop\.alert\s+Edit src\/a\.ts repeated/ })).toBeTruthy()
  expect(await pane.find({ type: 'Text', text: /old_string|new_string/ })).toBeFalsy()
  await pane.unmount()
})

test('large results are listed with their file and counted per tool', async ($, on) => {
  stubEngine(on, { id: 'session-test-1', toolText: { Read: 'x'.repeat(48_000) } })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.session.measure({ context: { tokens: 30_000, window: 200_000 }, rateLimits: [], changed: ['context'] })
  await $.tool.call({ tool: 'Read', file_path: '/work/app/big.json' })

  await $.command.run(open('context'))
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await pane.find({ type: 'Text', text: /^Largest tool results$/ })).toBeTruthy()
  expect(await pane.find({ type: 'Text', text: /^Read big\.json\s+█*░+\s+12k$/ })).toBeTruthy()
  await pane.press({ key: 'tab-tools' })
  expect((await pane.find({ type: 'Text', text: /^Read / }))?.text).toMatch(/\s12k\s/)
  await pane.unmount()
})

test('turns left come from the context at the end of each turn', async ($, on) => {
  const session = { id: 'session-test-1', tokens: 100_000, breakdown: { autoCompactThreshold: 180_000, isAutoCompactEnabled: true } }
  stubEngine(on, session)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  for (const id of ['t1', 't2', 't3']) {
    await $.turn.start({ text: 'go', turnId: id })
    await $.turn.complete(complete(id))
    session.tokens += 20_000
  }
  await $.session.measure({ context: { tokens: 140_000, window: 200_000 }, rateLimits: [], changed: ['context'] })

  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await band.find({ type: 'Text', text: /^≈2 turns to compaction$/ })).toBeTruthy()
  await band.unmount()
  await $.command.run(open('context'))
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await pane.find({ type: 'Text', text: /^180k$/ })).toBeTruthy()
  expect(await pane.find({ type: 'Text', text: /^20k$/ })).toBeTruthy()
  await pane.unmount()
})

test('fixed costs group MCP tools by server and keep the six largest', () => {
  const shares = fixedCosts({
    memoryFiles: [{ path: 'C:\\Users\\me\\.claude\\CLAUDE.md', type: 'User', tokens: 900 }],
    mcpTools: [
      { name: 'search', serverName: 'slack', tokens: 2000, isLoaded: true },
      { name: 'send', serverName: 'slack', tokens: 1000, isLoaded: true },
      { name: 'fetch', serverName: 'notion', tokens: 50, isLoaded: false },
    ],
    skills: { totalSkills: 3, includedSkills: 3, tokens: 400, skillFrontmatter: [] },
    agents: [{ agentType: 'Explore', source: 'built-in', tokens: 0 }],
  } as unknown as Parameters<typeof fixedCosts>[0])
  expect(shares).toEqual([
    { name: 'MCP slack', tokens: 3000 },
    { name: 'Memory .claude/CLAUDE.md', tokens: 900 },
    { name: 'Skill listing', tokens: 400 },
    { name: 'MCP notion', tokens: 50 },
  ])
})
