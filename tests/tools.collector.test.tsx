import { expect, test } from 'claude-code/testing'

import { BAND, PANE, stubEngine } from './engine-stubs'

const open = (args: string) => ({
  command: 'inspector',
  args,
  origin: { kind: 'composer' as const },
  presentation: { isFullscreen: false, columns: 120 },
})

test('tool calls are counted by name and passed on unchanged', async ($, on) => {
  stubEngine(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ran = await $.tool.call({ tool: 'Bash', command: 'ls' })
  expect(ran).toEqual({ result: {} })
  await $.tool.call({ tool: 'Bash', command: 'pwd' })
  await $.tool.call({ tool: 'Read', file_path: '/secret.txt' })

  await $.command.run(open('tools'))
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await pane.find({ type: 'Text', text: /^Bash / }))?.text).toMatch(/^Bash\s+2\s+0/)
  expect((await pane.find({ type: 'Text', text: /^Read / }))?.text).toMatch(/^Read\s+1\s+0/)
  expect(await pane.find({ type: 'Text', text: /secret|pwd/ })).toBeFalsy()
  await pane.press({ key: 'tab-activity' })
  expect(await pane.find({ type: 'Text', text: /^4\s+\S+\s+tool\.call\s+Read$/ })).toBeTruthy()
  expect(await pane.find({ type: 'Text', text: /secret|pwd/ })).toBeFalsy()
  await pane.press({ key: 'tab-files' })
  expect(await pane.find({ type: 'Text', text: /^\s+1\s+0\s+\S+\s+\/secret\.txt$/ })).toBeTruthy()
  await pane.unmount()

  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await band.find({ type: 'Text', text: /^3 tools$/ })).toBeTruthy()
  await band.unmount()
})

test('a denied tool call counts as a denial', async ($, on) => {
  on('tool.call', { tool: 'Write' }, () => ({ deny: 'not allowed' }))
  stubEngine(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ran = await $.tool.call({ tool: 'Write', file_path: '/work/app/x.ts', content: 'secret body' })
  expect(ran.deny).toBe('not allowed')
  await $.command.run(open('tools'))
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await pane.find({ type: 'Text', text: /^Write / }))?.text).toMatch(/^Write\s+1\s+0\s+1/)
  await pane.press({ key: 'tab-activity' })
  expect(await pane.find({ type: 'Text', text: /tool\.denied\s+Write denied/ })).toBeTruthy()
  expect(await pane.find({ type: 'Text', text: /secret body/ })).toBeFalsy()
  await pane.unmount()
})

test('MCP calls are grouped by server', async ($, on) => {
  stubEngine(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  // Typed loosely: the tool types list only the MCP servers connected on this machine.
  const callMcp = (tool: string) => $.tool.call({ tool } as Parameters<typeof $.tool.call>[0])
  await callMcp('mcp__slack__search')
  await callMcp('mcp__slack__send')
  await $.command.run(open('tools'))
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await pane.find({ type: 'Text', text: /^MCP servers$/ })).toBeTruthy()
  expect(await pane.find({ type: 'Text', text: /^slack\s+2 calls {2}search, send$/ })).toBeTruthy()
  await pane.unmount()
})

test('a failed tool call counts as an error', async ($, on) => {
  stubEngine(on, { id: 'session-test-1', toolFails: true })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'Bash', command: 'false' })
  await $.command.run(open('tools'))
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await pane.find({ type: 'Text', text: /^Bash / }))?.text).toMatch(/^Bash\s+1\s+1/)
  await pane.unmount()
})

test('a subagent is recorded with its own tool calls and finish', async ($, on) => {
  stubEngine(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.agent.spawn({
    tool_use_id: 'call-1',
    prompt: 'look around',
    description: 'Find the config files',
    subagentType: 'Explore',
    provider: { plugin: 'engine', tier: 'core' },
    parentModel: 'claude-opus-5-5',
    background: false,
    fork: false,
  })
  await $.tool.call({ tool: 'Grep', pattern: 'x', agentId: 'agent-1' })
  await $.turn.complete({ answer: '', durationMs: 7000, isAborted: false, turnId: 't9', reason: 'answer', agentId: 'agent-1' })

  await $.command.run(open('agents'))
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await pane.find({ type: 'Text', text: /^Explore {2}completed$/ })).toBeTruthy()
  expect(await pane.find({ type: 'Text', text: /^Find the config files$/ })).toBeTruthy()
  expect(await pane.find({ type: 'Text', text: /^0 turns {3}1 tool calls {3}7s {3}haiku {3}agent-1$/ })).toBeTruthy()
  expect(await pane.find({ type: 'Text', text: /^Tools: Grep$/ })).toBeTruthy()
  await pane.unmount()
})

test('no agents seen means none are shown', async ($, on) => {
  stubEngine(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.command.run(open('agents'))
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await pane.find({ type: 'Text', text: /No subagents in this session/ })).toBeTruthy()
  await pane.unmount()
})
