import { describe, expect, test } from 'claude-code/testing'

import { AGENT_COLORS, agentColor, agentMark } from '../src/ui/agent-row'

describe('agent row colors', () => {
  test('rows side by side get different colors, in list order', () => {
    const ids = ['a', 'b', 'c']
    expect(ids.map(id => agentColor(id, ids))).toEqual([AGENT_COLORS[0], AGENT_COLORS[1], AGENT_COLORS[2]])
    expect(new Set(AGENT_COLORS).size).toBe(AGENT_COLORS.length)
  })

  test('colors repeat only past the palette, and an unknown id takes the first', () => {
    const ids = Array.from({ length: AGENT_COLORS.length + 1 }, (_, index) => `a${index}`)
    expect(agentColor(`a${AGENT_COLORS.length}`, ids)).toBe(AGENT_COLORS[0])
    expect(agentColor('missing', ids)).toBe(AGENT_COLORS[0])
  })

  test('working agents get a filled mark, stopped ones a hollow mark', () => {
    expect(['pending', 'running', 'waiting'].map(agentMark)).toEqual(['●', '●', '●'])
    expect(['idle', 'completed', 'failed', 'killed'].map(agentMark)).toEqual(['○', '○', '○', '○'])
  })
})

const row = (id: string, status: 'running' | 'completed', isHidden = false) => ({
  plugin: 'session-inspector',
  component: 'AgentRow' as const,
  requestId: id,
  // The agent as the engine lists it; only id, status and rowIds matter to the mod.
  props: {
    id,
    description: 'Find the config files',
    type: 'Explore',
    status,
    rowIds: ['agent-a', 'agent-b', 'agent-c'],
    isHidden,
  } as never,
})

test('each row keeps the engine row and gains its own colored mark, on every surface', async ($, on) => {
  on('ui.render', { component: 'AgentRow' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine row</Text>
  })
  for (const surface of ['terminal', 'desktop'] as const) {
    const marks: (string | undefined)[] = []
    for (const id of ['agent-a', 'agent-b', 'agent-c']) {
      const ui = await $.ui.mount({ ...row(id, 'running'), surface })
      const texts = await ui.findAll({ type: 'Text' })
      expect(texts.map(found => found.text)).toEqual(['● ', 'engine row'])
      marks.push(JSON.stringify(texts[0]))
      await ui.unmount()
    }
    expect(new Set(marks).size).toBe(3)
  }
})

test('a finished agent shows a hollow mark, and a hidden row stays the engine\'s', async ($, on) => {
  on('ui.render', { component: 'AgentRow' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine row</Text>
  })
  const done = await $.ui.mount({ ...row('agent-b', 'completed'), surface: 'terminal' })
  expect((await done.findAll({ type: 'Text' })).map(found => found.text)).toEqual(['○ ', 'engine row'])
  await done.unmount()
  const hidden = await $.ui.mount({ ...row('agent-c', 'running', true), surface: 'terminal' })
  expect((await hidden.findAll({ type: 'Text' })).map(found => found.text)).toEqual(['engine row'])
  await hidden.unmount()
})
