import { expect, test } from 'claude-code/testing'

import { patchLines, toolLines } from '../src/domain/code-lines'
import { BAND, PANE, SESSION_ID, USAGE, stubEngine } from './engine-stubs'

async function texts(view: { findAll: (query: { type: 'Text' }) => Promise<{ text: string }[]> }): Promise<string[]> {
  return (await view.findAll({ type: 'Text' })).map(found => found.text)
}

// The value printed right after a band label.
const after = (lines: string[], label: string) => lines[lines.findIndex(text => text.trim() === label) + 1]

const HUNK = { oldStart: 1, oldLines: 3, newStart: 1, newLines: 4, lines: [' keep', '-old', '+new one', '+new two', ' keep'] }

test('code lines are counted from each hunk, as /usage counts them', () => {
  expect(patchLines([HUNK, { ...HUNK, lines: ['-gone'] }])).toEqual({ added: 2, removed: 2 })
  expect(patchLines(undefined)).toEqual({ added: 0, removed: 0 })
  expect(toolLines('Edit', { structuredPatch: [HUNK] })).toEqual({ added: 2, removed: 1 })
  expect(toolLines('Write', { type: 'create', structuredPatch: [], content: 'a\nb\nc\n' })).toEqual({ added: 3, removed: 0 })
  expect(toolLines('Write', { type: 'update', structuredPatch: [HUNK] })).toEqual({ added: 2, removed: 1 })
  expect(toolLines('Bash', { structuredPatch: [HUNK] })).toBeUndefined()
  expect(toolLines('Edit', 'not an object')).toBeUndefined()
})

test('the band counts the lines each edit changed, at once, and a failed edit adds none', async ($, on) => {
  let fails = false
  on('tool.call', { tool: 'Edit' }, () => (fails ? { result: {}, isError: true as const, text: 'failed' } : { result: { structuredPatch: [HUNK] } }))
  on('tool.call', { tool: 'Write' }, () => ({ result: { type: 'create', structuredPatch: [], content: 'x\ny\n' } }))
  stubEngine(on, { id: SESSION_ID })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(after(await texts(band), 'session code')).toBe('+0')
  await $.tool.call({ tool: 'Edit', file_path: '/a.ts', old_string: 'old', new_string: 'new' })
  await $.tool.call({ tool: 'Write', file_path: '/b.ts', content: 'x\ny\n' })
  fails = true
  await $.tool.call({ tool: 'Edit', file_path: '/a.ts', old_string: 'x', new_string: 'y' })
  expect(after(await texts(band), 'session code')).toBe('+4')
  expect(await texts(band)).toContain(' −1')
  await band.unmount()

  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await pane.find({ type: 'Text', text: /^\+4 {2}−1$/ })).toBeTruthy()
  await pane.unmount()
})

test('the cost follows the session total every ten seconds, mods’ model calls included', async ($, on) => {
  const session = { id: SESSION_ID, costUsd: 5.09 }
  const { clock } = stubEngine(on, session)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await clock.settle()

  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(after(await texts(band), 'cost')).toBe('$5.09')
  session.costUsd = 5.12
  await clock.advance(9_999)
  expect(after(await texts(band), 'cost')).toBe('$5.09')
  await clock.advance(1)
  expect(after(await texts(band), 'cost')).toBe('$5.12')
  await band.unmount()
})

test('the cost also refreshes when Claude finishes a response, without waiting for the timer', async ($, on) => {
  const session = { id: SESSION_ID, costUsd: 1 }
  const { clock } = stubEngine(on, session)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await clock.settle()
  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(after(await texts(band), 'cost')).toBe('$1.00')

  session.costUsd = 2
  await $.turn.start({ text: 'hi', turnId: 't1' })
  await $.turn.complete({ answer: 'ok', durationMs: 10, isAborted: false, turnId: 't1', reason: 'answer', usage: USAGE })
  await clock.settle()
  expect(after(await texts(band), 'cost')).toBe('$2.00')
  await band.unmount()
})

test('lines made before the inspector loaded are counted from the transcript, subagents included', async ($, on) => {
  const edit = (id: string, result: unknown) => ({ tool_use_id: id, tool: 'Edit', input: {}, result })
  on('session.messages', (_, e) => {
    if (e.agentId === 'agent-1') return { value: [{ role: 'assistant', text: '', toolUses: [edit('s1', { structuredPatch: [HUNK] })] }] }
    return {
      value: [
        { role: 'user', text: 'hi', toolUses: [] },
        {
          role: 'assistant',
          text: '',
          toolUses: [
            edit('m1', { structuredPatch: [HUNK] }),
            { tool_use_id: 'm2', tool: 'Write', input: {}, result: { type: 'create', structuredPatch: [], content: 'a\nb\n' } },
            { ...edit('m3', 'refused'), isError: true },
            { tool_use_id: 'm4', tool: 'Agent', input: {}, result: {}, agentId: 'agent-1' },
          ],
        },
      ],
    }
  })
  const { clock } = stubEngine(on, { id: SESSION_ID })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await clock.settle()
  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(after(await texts(band), 'session code')).toBe('+6')
  expect(await texts(band)).toContain(' −2')
  await band.unmount()
})
