import { expect, test } from 'claude-code/testing'

import { BAND, SESSION_ID, USAGE, stubEngine } from './engine-stubs'

async function texts(view: { findAll: (query: { type: 'Text' }) => Promise<{ text: string }[]> }): Promise<string[]> {
  return (await view.findAll({ type: 'Text' })).map(found => found.text)
}

test('the rate-limit windows come only from Claude Code; the inspector makes no network request', async ($, on) => {
  let fetches = 0
  let authorizations = 0
  const { clock } = stubEngine(on, { id: SESSION_ID })
  on('session.authorize', () => {
    authorizations += 1
    return { value: { handle: 'handle-1', kind: 'bearer' as const } }
  })
  on('http.fetch', () => {
    fetches += 1
    return { value: { status: 200, ok: true, headers: {}, text: '{}' } }
  })

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.session.measure({
    context: { tokens: 10_000, window: 200_000 },
    rateLimits: [{ kind: 'five_hour', percentUsed: 42 }, { kind: 'seven_day', percentUsed: 17 }],
    changed: ['context', 'rateLimits'],
  })
  await $.turn.complete({ answer: 'ok', durationMs: 10, isAborted: false, turnId: 't1', reason: 'answer', usage: USAGE })
  await clock.settle()
  await clock.advance(60_000)

  expect(fetches).toBe(0)
  expect(authorizations).toBe(0)
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const shown = (await texts(band)).join('')
  expect(shown).toContain('42%')
  expect(shown).toContain('17%')
  await band.unmount()
})
