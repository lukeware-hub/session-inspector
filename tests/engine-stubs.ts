import type { On } from 'claude-code'
import { mock } from 'claude-code/testing'

export const SESSION_ID = 'session-test-1'
export const MODEL = 'claude-opus-5-5'
export const STARTED_AT = 1_000_000

export const CWD = '/work/app'

export type Session = {
  id: string
  tokens?: number
  isPlaced?: boolean
  toolFails?: boolean
  // Host command output by executable name; a command not listed fails.
  host?: Record<string, string | ((argv: readonly string[]) => string)>
}

// Stands for the engine beneath the plugin: each hook answers as a session does.
export function stubEngine(on: On, session: Session = { id: SESSION_ID }) {
  const clock = mock.clock(on, { now: STARTED_AT })
  const toasts: string[] = []
  const commands: string[] = []
  const panes: string[] = []
  const ran: string[][] = []
  on('session.id', () => ({ value: session.id }))
  on('session.model', () => ({ value: MODEL }))
  on('session.cwd', () => ({ value: CWD }))
  on('session.repo', () => ({ value: session.host?.git ? { root: CWD, remote: null, internal: false, name: 'app' } : null }))
  on('session.info', () => ({ value: { transcriptPath: '', platform: 'linux' as const } }))
  on('process.run', (_, e) => {
    ran.push([...e.argv])
    const answer = session.host?.[e.argv[0] ?? '']
    const stdout = typeof answer === 'function' ? answer(e.argv) : answer
    return { value: { exitCode: stdout === undefined ? 1 : 0, stdout: stdout ?? '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('session.usage', () => ({
    value: {
      startedAt: STARTED_AT,
      context: { tokens: session.tokens, window: 200_000 },
      rateLimits: [],
    },
  }))
  on('command.register', (_, e) => {
    commands.push(e.name)
    return { value: { command: e.name } }
  })
  on('ui.open', (_, e) => {
    panes.push(e.id)
    return { value: session.isPlaced === false ? { isPlaced: false, reason: 'no room' } : { isPlaced: true } }
  })
  on('ui.toast', (_, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.end', (_, e) => ({ sessionId: e.sessionId }))
  on('session.measure', (_, e) => ({ changed: e.changed }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
  on('tool.call', () => (session.toolFails ? { result: {}, isError: true as const, text: 'failed' } : { result: {} }))
  on('agent.spawn', () => ({ model: 'haiku', agentId: 'agent-1' }))
  return { clock, toasts, commands, panes, ran }
}

export const USAGE = {
  input_tokens: 1000,
  output_tokens: 500,
  cache_read_input_tokens: 2000,
  cache_creation_input_tokens: 0,
  model: MODEL,
}

export const PANE = {
  plugin: 'session-inspector',
  component: 'Pane',
  requestId: 'session-inspector',
  props: {
    title: 'Session Inspector',
    isFocused: false,
    bodyColumns: 100,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

export const BAND = {
  plugin: 'session-inspector',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isCollapsed: false,
    isWorking: false,
    maxRows: 6,
    bodyColumns: 160,
    scroll: { offset: 0, bodyRows: 6 },
    view: {},
  },
} as const

export const SURFACES = ['terminal', 'desktop'] as const

