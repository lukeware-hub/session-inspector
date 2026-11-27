import { expect, test, type Engine } from 'claude-code/testing'

import { BAND, PANE, SESSION_ID, STARTED_AT, USAGE, stubEngine } from './engine-stubs'

const complete = (turnId: string, extra: { agentId?: string } = {}) => ({
  answer: 'done',
  durationMs: 4000,
  isAborted: false,
  turnId,
  reason: 'answer' as const,
  usage: USAGE,
  ...extra,
})

const sessionsPane = async ($: Engine) => {
  await $.command.run({ command: 'inspector', args: 'sessions', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } })
  return $.ui.mount({ ...PANE, surface: 'terminal' })
}

test('turns count, tokens add up and the status follows the turn', async ($, on) => {
  const { clock } = stubEngine(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.turn.start({ text: 'hi', turnId: 't1' })

  const running = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await running.find({ type: 'Text', text: /● running/ })).toBeTruthy()
  await running.unmount()

  await clock.advance(65_000)
  await $.turn.complete(complete('t1'))
  await $.turn.start({ text: 'again', turnId: 't2' })
  await $.turn.complete(complete('t2'))

  const pane = await sessionsPane($)
  expect(await pane.find({ type: 'Text', text: new RegExp(SESSION_ID) })).toBeTruthy()
  expect(await pane.find({ type: 'Text', text: /^idle$/ })).toBeTruthy()
  expect(await pane.find({ type: 'Text', text: /^1m 05s$/ })).toBeTruthy()
  const lines = (await pane.findAll({ type: 'Text' })).map(found => found.text)
  expect(lines.slice(lines.indexOf('Input               '), lines.indexOf('Input               ') + 8)).toEqual([
    'Input               ', '2k', 'Output              ', '1k', 'Cache read          ', '4k', 'Cache write         ', '0',
  ])
  await pane.unmount()
  expect(STARTED_AT).toBeGreaterThan(0)
})

// The first numstat read is the session's baseline: nothing was changed yet.
let numstatReads = 0
function isBaseline(_argv: readonly string[]): boolean {
  numstatReads += 1
  return numstatReads === 1
}

test('git lines already changed before the session are not counted', async ($, on) => {
  let reads = 0
  stubEngine(on, {
    id: SESSION_ID,
    host: { git: argv => (argv[1] === 'rev-parse' ? 'abc123\n' : ++reads === 1 ? '5\t1\told.ts\n' : '12\t3\told.ts\n1\t0\tnew.ts\n') },
  })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.turn.start({ text: 'hi', turnId: 't1' })
  await $.turn.complete(complete('t1'))
  await $.command.run({ command: 'inspector', args: 'files', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } })
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await pane.find({ type: 'Text', text: /^\+8 {2}−2$/ })).toBeTruthy()
  expect(await pane.find({ type: 'Text', text: /^1 since the session began$/ })).toBeTruthy()
  await pane.unmount()
})

test('git lines and process resources are measured from the host', async ($, on) => {
  const { ran } = stubEngine(on, {
    id: SESSION_ID,
    host: {
      git: argv => (argv[1] === 'rev-parse' ? 'abc123\n' : isBaseline(argv) ? '' : '12\t3\tsrc/a.ts\n1\t0\tREADME.md\n'),
      '/bin/sh': '50\n10 1 524288 00:00:02 claude\n50 10 100 00:00:00 sh\n',
    },
  })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.turn.start({ text: 'hi', turnId: 't1' })
  await $.turn.complete(complete('t1'))
  await $.command.run({ command: 'inspector', args: 'files', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } })

  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await pane.find({ type: 'Text', text: /^\+13 {2}−3$/ })).toBeTruthy()
  expect(await pane.find({ type: 'Text', text: /^2 since the session began$/ })).toBeTruthy()
  await pane.press({ key: 'tab-system' })
  expect(await pane.find({ type: 'Text', text: /^512 MB$/ })).toBeTruthy()
  expect(await pane.find({ type: 'Text', text: /^1 in the Claude Code tree$/ })).toBeTruthy()
  await pane.unmount()

  expect(ran).toContainEqual(['git', 'diff', '--numstat', 'abc123'])
  expect(ran.every(argv => argv[0] === 'git' || argv[0] === '/bin/sh')).toBe(true)
})

test('a subagent turn counts apart from the main turns', async ($, on) => {
  stubEngine(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.turn.start({ text: '', turnId: 't1', agentId: 'agent-x' })
  await $.turn.complete(complete('t1', { agentId: 'agent-x' }))
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await pane.find({ type: 'Text', text: /0 started, 0 running, 1 turns/ })).toBeTruthy()
  expect(await pane.find({ type: 'Text', text: /^0$/ })).toBeTruthy()
  await pane.unmount()
})

test('the session end is recorded with its reason', async ($, on) => {
  stubEngine(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.session.end({ reason: 'prompt_input_exit', sessionId: SESSION_ID, resume: { id: 'r1' } })
  const pane = await sessionsPane($)
  expect(await pane.find({ type: 'Text', text: /ended \(prompt_input_exit\)/ })).toBeTruthy()
  await pane.unmount()
})

test('a new session id after /clear starts the values over', async ($, on) => {
  const session = { id: 'first' }
  stubEngine(on, session)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  await $.session.end({ reason: 'clear', sessionId: 'first', resume: { id: 'r1' } })
  session.id = 'second'
  await $.turn.start({ text: 'fresh', turnId: 't1' })

  const pane = await sessionsPane($)
  expect(await pane.find({ type: 'Text', text: /second/ })).toBeTruthy()
  expect(await pane.find({ type: 'Text', text: /^running$/ })).toBeTruthy()
  await pane.press({ key: 'tab-tools' })
  expect(await pane.find({ type: 'Text', text: /No tool calls yet/ })).toBeTruthy()
  await pane.unmount()
})

test('a new session id keeps the account rate limits', async ($, on) => {
  const session = { id: 'first' }
  stubEngine(on, session)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.session.measure({ context: { tokens: 10_000, window: 200_000 }, rateLimits: [{ kind: 'five_hour', percentUsed: 42 }], changed: ['rateLimits'] })
  session.id = 'second'
  await $.turn.start({ text: 'fresh', turnId: 't1' })

  const pane = await sessionsPane($)
  expect(await pane.find({ type: 'Text', text: /42%/ })).toBeTruthy()
  await pane.unmount()
})
