import { describe, expect, test, type Engine } from 'claude-code/testing'

import { activeAgents, spawnAgent, syncAgentStatuses } from '../src/domain/reducers'
import { subagentsSegment } from '../src/ui/above-prompt'
import { BAND, MODEL, stubEngine } from './engine-stubs'

const SPAWN = {
  tool_use_id: 'call-1',
  prompt: 'look around',
  description: 'Find the config files',
  subagentType: 'Explore',
  provider: { plugin: 'engine', tier: 'core' as const },
  parentModel: MODEL,
  background: false,
  fork: false,
}

describe('subagents running now', () => {
  test('pending, running and waiting agents count as working', () => {
    const agents = ['pending', 'running', 'waiting', 'idle', 'completed', 'failed', 'killed'].map((status, index) => ({
      ...spawnAgent([], { id: `a${index}`, type: 'Explore', description: '', at: 0 })[0]!,
      status,
    }))
    expect(activeAgents(agents)).toBe(3)
    expect(activeAgents([])).toBe(0)
  })

  test('the live list corrects a status; agents it no longer has keep theirs', () => {
    const agents = [...spawnAgent([], { id: 'a1', type: 'Explore', description: '', at: 0 }), ...spawnAgent([], { id: 'a2', type: 'Plan', description: '', at: 0 })]
    const synced = syncAgentStatuses(agents, [{ id: 'a1', status: 'killed' }, { id: 'other', status: 'running' }])
    expect(synced.map(agent => agent.status)).toEqual(['killed', 'running'])
    expect(synced.length).toBe(2)
  })

  test('the band segment reads none, then running out of total', () => {
    expect(subagentsSegment([])).toEqual({ label: 'subagents', text: '0 running', dim: true })
    const agents = spawnAgent([], { id: 'a1', type: 'Explore', description: '', at: 0 })
    expect(subagentsSegment(agents)).toEqual({ label: 'subagents', text: '1 running of 1', color: 'success', bold: true })
    expect(subagentsSegment([{ ...agents[0]!, status: 'completed' }])).toEqual({ label: 'subagents', text: '0 running of 1', color: undefined, bold: false })
  })
})

const bandLines = async ($: Engine) => {
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const lines = (await band.findAll({ type: 'Text' })).map(found => found.text)
  await band.unmount()
  return lines[lines.findIndex(text => text.trim() === 'subagents') + 1]
}

test('the band counts a subagent while it runs and stops when it finishes', async ($, on) => {
  stubEngine(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  expect(await bandLines($)).toBe('0 running')
  await $.agent.spawn(SPAWN)
  expect(await bandLines($)).toBe('1 running of 1')
  await $.turn.complete({ answer: '', durationMs: 5000, isAborted: false, turnId: 't9', reason: 'answer', agentId: 'agent-1' })
  expect(await bandLines($)).toBe('0 running of 1')
})

test('an agent the engine stopped stops counting after the next turn', async ($, on) => {
  const session = { id: 'session-test-1', liveAgents: [{ id: 'agent-1', status: 'running' }] }
  stubEngine(on, session)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.agent.spawn(SPAWN)
  session.liveAgents = [{ id: 'agent-1', status: 'killed' }]
  await $.turn.start({ text: 'go', turnId: 't1' })
  expect(await bandLines($)).toBe('0 running of 1')
})
