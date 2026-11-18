import type { On } from 'claude-code'

import { TABS, type InspectorTab } from '../domain/models'
import { PANE_ID, PANE_ROWS, PANE_TITLE } from '../state/keys'
import { syncAgents } from '../collectors/agents.collector'
import { inBackground, refreshGit, sampleSystem } from '../collectors/host.collector'
import { setTab, type Engine } from '../state/repository'

export async function registerInspectorCommand($: Engine): Promise<void> {
  await $.command.register({
    name: 'inspector',
    description: 'Open the Session Inspector pane (optional section: overview, context, sessions, activity, tools, agents, files, system)',
    argumentHint: '[section]',
  })
}

// The section named in the command's arguments, if it is one.
export function parseTab(args: string): InspectorTab | undefined {
  const word = args.trim().toLowerCase()
  return TABS.find(tab => tab === word)
}

export function registerInspectorCommandHandler(on: On): void {
  on('command.run', { command: 'inspector' }, async ($, e) => {
    const tab = parseTab(e.args)
    if (tab) await setTab($, tab)
    inBackground(sampleSystem($))
    inBackground(syncAgents($))
    inBackground(refreshGit($))
    // Seated inline the pane sits right above the prompt; `rows` asks for room for every section.
    const opened = await $.ui.open({ id: PANE_ID, title: PANE_TITLE, rows: PANE_ROWS })
    return {
      text: opened.isPlaced
        ? 'Session Inspector opened.'
        : 'Session Inspector is waiting for room: widen the terminal to show the pane.',
    }
  })
}
