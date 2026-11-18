import type { Register } from 'claude-code'

import { registerAgentsCollector } from '../src/collectors/agents.collector'
import { recordContext, registerContextCollector } from '../src/collectors/context.collector'
import { inBackground, sampleSystem } from '../src/collectors/host.collector'
import { registerSessionCollector, syncSession } from '../src/collectors/session.collector'
import { registerSpeedCollector } from '../src/collectors/speed.collector'
import { registerToolsCollector } from '../src/collectors/tools.collector'
import { registerInspectorCommand, registerInspectorCommandHandler } from '../src/commands/inspector.command'
import { registerAbovePrompt } from '../src/ui/above-prompt'
import { registerAgentRow } from '../src/ui/agent-row'
import { registerInspectorPane } from '../src/ui/inspector-pane'

// Session Inspector observes the session: every hook passes the event on unchanged.
export const register: Register = on => {
  // Runs again on each hot reload; the values of the same session are kept.
  on('session.start', async ($, e, next) => {
    await registerInspectorCommand($)
    await syncSession($)
    await recordContext($, (await $.session.usage()).context)
    inBackground(sampleSystem($))
    return next(e)
  }).catch(($, e, next) => next(e))

  registerSessionCollector(on)
  registerContextCollector(on)
  registerToolsCollector(on)
  registerAgentsCollector(on)
  registerSpeedCollector(on)
  registerInspectorCommandHandler(on)
  registerAbovePrompt(on)
  registerAgentRow(on)
  registerInspectorPane(on)
}
