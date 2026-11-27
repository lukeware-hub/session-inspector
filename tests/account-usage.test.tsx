import { expect, test } from 'claude-code/testing'

import { parseAccountUsage } from '../src/domain/account-usage'
import { BAND, PANE, SESSION_ID, stubEngine } from './engine-stubs'

const body = (fiveHour: number, sevenDay: number) =>
  JSON.stringify({
    five_hour: { utilization: fiveHour, resets_at: '2026-11-27T15:09:59.898932+00:00' },
    seven_day: { utilization: sevenDay, resets_at: '2026-12-02T16:59:59.898953+00:00' },
    seven_day_opus: null,
    extra_usage: { is_enabled: false },
  })

async function texts(view: { findAll: (query: { type: 'Text' }) => Promise<{ text: string }[]> }): Promise<string[]> {
  return (await view.findAll({ type: 'Text' })).map(found => found.text)
}

test('the account usage answer becomes one rate-limit window per reported window', () => {
  expect(parseAccountUsage(body(3, 39))).toEqual([
    { kind: 'five_hour', percentUsed: 3, resetsAt: '2026-11-27T15:09:59.898932+00:00' },
    { kind: 'seven_day', percentUsed: 39, resetsAt: '2026-12-02T16:59:59.898953+00:00' },
  ])
  expect(parseAccountUsage('not json')).toBeUndefined()
  expect(parseAccountUsage('{"five_hour":null}')).toBeUndefined()
})

test('the band reads the account usage at start and again every ten seconds, as /usage shows it', async ($, on) => {
  const usage = { fiveHour: 3, sevenDay: 39 }
  const fetched: { url: string; auth?: string }[] = []
  const { clock } = stubEngine(on, { id: SESSION_ID })
  on('session.authorize', () => ({ value: { handle: 'handle-1', kind: 'bearer' as const } }))
  on('http.fetch', (_, e) => {
    fetched.push({ url: e.url, auth: e.init?.auth })
    return { value: { status: 200, ok: true, headers: {}, text: body(usage.fiveHour, usage.sevenDay) } }
  })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await clock.settle()

  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await texts(band)).join('')).toContain('3%')
  expect((await texts(band)).join('')).toContain('39%')
  expect(fetched[0]).toEqual({ url: 'https://api.anthropic.com/api/oauth/usage', auth: 'handle-1' })

  usage.fiveHour = 7
  await clock.advance(10_000)
  expect((await texts(band)).join('')).toContain('7%')
  await band.unmount()

  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await pane.press({ key: 'tab-sessions' })
  expect((await texts(pane)).join('')).toContain('Limit 5h')
  await pane.unmount()
})

test('without a subscription sign-in the account usage is never fetched', async ($, on) => {
  let calls = 0
  const { clock } = stubEngine(on, { id: SESSION_ID })
  on('session.authorize', () => ({ value: { handle: 'key-1', kind: 'api-key' as const } }))
  on('http.fetch', () => {
    calls += 1
    return { value: { status: 200, ok: true, headers: {}, text: body(1, 1) } }
  })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await clock.settle()
  await clock.advance(10_000)
  expect(calls).toBe(0)
})
