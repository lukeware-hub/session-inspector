import type { On, SessionContextBreakdown } from 'claude-code'

import {
  fit,
  formatBytes,
  formatClock,
  formatDuration,
  formatPercent,
  formatRate,
  formatTokens,
  formatUsd,
  limitLabel,
  sparkline,
} from '../domain/formatters'
import { activeLoopAlert, compactionLimit, forecastTurns } from '../domain/insights'
import { TABS, type InspectorState, type InspectorTab } from '../domain/models'
import { activeAgents, mcpGroups, mcpServer, sessionDurationMs, slowestTools, toolDistribution, totalTokens } from '../domain/reducers'
import { contextLevel, levelLabel } from '../domain/thresholds'
import { PANE_ID } from '../state/keys'
import { readState, setTab, type Engine } from '../state/repository'
import { LEVEL_COLOR, STATUS_MARK, empty, field, forecastSegment, heading, loadColor, meter, type Ui } from './components'

const TAB_LABEL: Record<InspectorTab, string> = {
  overview: 'Overview',
  context: 'Context',
  sessions: 'Session',
  activity: 'Activity',
  tools: 'Tools',
  agents: 'Agents',
  files: 'Files',
  system: 'System',
}

export type TokenShare = { name: string; tokens: number }

// What /context reports about the window: its categories, and the fixed items that load every turn.
export type BreakdownView = { categories: TokenShare[]; fixed: TokenShare[] }

type View = {
  ui: Ui
  state: InspectorState
  now: number
  columns: number
  rows: number
  breakdown?: BreakdownView
}

const FIXED_COSTS = 6

function shareRow(ui: Ui, share: TokenShare, window: number, columns: number) {
  const { Text } = ui
  return <Text>{fit(`${fit(share.name, 28).padEnd(28)}  ${meter((share.tokens / window) * 100)}  ${formatTokens(share.tokens).padStart(6)}`, columns)}</Text>
}

function overview({ ui, state, now, columns }: View) {
  const { Box } = ui
  const { session, stats, agents, contextReadings, usage, git, system, speed } = state
  const reading = contextReadings.at(-1)
  const level = reading && contextLevel(reading.percent)
  const running = activeAgents(agents)
  const mark = STATUS_MARK[session.status]
  const forecast = forecastSegment(state)
  const loop = activeLoopAlert(state.loop, now)
  return (
    <Box flexDirection="column">
      {field(ui, 'Session status', `${mark.glyph} ${session.status}`, columns, mark.color)}
      {field(ui, 'Current model', session.model ?? '—', columns)}
      {field(ui, 'Effort', session.effort ?? '—', columns)}
      {field(ui, 'Context usage', reading && level ? `${meter(reading.percent)} ${formatPercent(reading.percent)}  ${levelLabel(level)}` : '—', columns, level && LEVEL_COLOR[level])}
      {field(ui, 'Context window', formatTokens(reading?.window), columns)}
      {field(ui, 'Turns left', forecast?.text ?? '—', columns, forecast?.color)}
      {field(ui, 'Loop alert', loop ?? 'none', columns, loop ? 'error' : undefined)}
      {field(ui, 'Tokens used', `${formatTokens(totalTokens(stats))} in this session`, columns)}
      {field(ui, 'Turns', String(stats.totalTurns), columns)}
      {field(ui, 'Tool calls', String(stats.totalToolCalls), columns)}
      {field(ui, 'Subagents', `${agents.length} started, ${running} running, ${stats.totalSubagentTurns} turns`, columns)}
      {field(ui, 'Cost (estimate)', formatUsd(usage.costUsd), columns)}
      {field(ui, 'Lines changed', git.isRepo && git.checkedAt !== undefined ? `+${git.added}  −${git.removed} in ${git.files} files` : '—', columns)}
      {field(ui, 'Speed', speed.tokensPerSecond === undefined ? '—' : `${speed.tokensPerSecond} tokens/s`, columns)}
      {field(ui, 'CPU and memory', system.memoryBytes === undefined ? '—' : `${system.cpuPercent ?? '—'}%  ${formatBytes(system.memoryBytes)}`, columns)}
      {field(ui, 'Session duration', formatDuration(sessionDurationMs(session, now)), columns)}
      {field(ui, 'Last activity', formatClock(session.lastActivity), columns)}
      {field(ui, 'Events', String(state.activity.total), columns)}
    </Box>
  )
}

function context({ ui, state, columns, breakdown }: View) {
  const { Box, Progress, Text } = ui
  const readings = state.contextReadings
  const reading = readings.at(-1)
  if (!reading) return empty(ui, 'No reading yet. The first model response reports how full the context window is.')
  const level = contextLevel(reading.percent)
  const { compactions, lastCompaction } = state.stats
  const { pressure, results } = state
  const limit = compactionLimit(pressure, reading.window)
  const forecast = forecastTurns(pressure.turnTokens, reading.tokens, limit)
  const turnsLeft = forecastSegment(state)
  return (
    <Box flexDirection="column">
      <Progress label="Context window" value={reading.percent} max={100} valueText={formatPercent(reading.percent)} color={LEVEL_COLOR[level]} />
      {field(ui, 'Level', levelLabel(level), columns, LEVEL_COLOR[level])}
      {field(ui, 'Tokens in context', formatTokens(reading.tokens), columns)}
      {field(ui, 'Window size', formatTokens(reading.window), columns)}
      {field(ui, 'Tokens available', formatTokens(Math.max(0, reading.window - reading.tokens)), columns)}
      {field(ui, 'Compactions', compactions ? `${compactions}, last at ${formatClock(lastCompaction?.at)} (${lastCompaction?.trigger})` : 'none', columns)}
      {field(ui, 'Compaction at', pressure.isAutoCompact && pressure.threshold ? formatTokens(pressure.threshold) : 'auto-compaction off: the window size', columns)}
      {field(ui, 'Growth per turn', forecast.growthPerTurn === undefined ? 'known after two turns' : formatTokens(forecast.growthPerTurn), columns)}
      {field(ui, 'Turns left', turnsLeft?.text ?? '—', columns, turnsLeft?.color)}
      <Text dimColor>{fit('Tokens in context count the last response only; the session total is on Overview.', columns)}</Text>
      {breakdown && breakdown.categories.length > 0 && heading(ui, 'What fills the window')}
      {breakdown?.categories.map(share => shareRow(ui, share, reading.window, columns))}
      {breakdown && breakdown.fixed.length > 0 && heading(ui, 'Loaded every turn')}
      {breakdown?.fixed.map(share => shareRow(ui, share, reading.window, columns))}
      {results.length > 0 && heading(ui, 'Largest tool results')}
      {results.map(result => shareRow(ui, { name: result.target ? `${result.tool} ${result.target}` : result.tool, tokens: result.tokens }, reading.window, columns))}
      {heading(ui, 'Last readings')}
      <Text dimColor>{fit(`History ${sparkline(readings.map(one => one.percent))}`, columns)}</Text>
      {[...readings].reverse().map(one => (
        <Text color={LEVEL_COLOR[contextLevel(one.percent)]}>
          {fit(`${formatClock(one.timestamp)}  ${meter(one.percent)} ${formatPercent(one.percent).padStart(4)}  ${formatTokens(one.tokens)} / ${formatTokens(one.window)}`, columns)}
        </Text>
      ))}
    </Box>
  )
}

function sessions({ ui, state, now, columns }: View) {
  const { Box } = ui
  const { session, stats, usage } = state
  return (
    <Box flexDirection="column">
      {field(ui, 'Session id', session.id ?? '—', columns)}
      {field(ui, 'Status', session.endReason ? `${session.status} (${session.endReason})` : session.status, columns, STATUS_MARK[session.status].color)}
      {field(ui, 'Started', formatClock(session.startTime), columns)}
      {field(ui, 'Ended', formatClock(session.endTime), columns)}
      {field(ui, 'Duration', formatDuration(sessionDurationMs(session, now)), columns)}
      {field(ui, 'Turns', String(stats.totalTurns), columns)}
      {field(ui, 'Tool calls', String(stats.totalToolCalls), columns)}
      {field(ui, 'Model', session.model ?? '—', columns)}
      {field(ui, 'Last activity', `${formatClock(session.lastActivity)}, ${state.activity.total} events`, columns)}
      {heading(ui, 'Tokens')}
      {field(ui, 'Input', formatTokens(stats.inputTokens), columns)}
      {field(ui, 'Output', formatTokens(stats.outputTokens), columns)}
      {field(ui, 'Cache read', formatTokens(stats.cacheReadTokens), columns)}
      {field(ui, 'Cache write', formatTokens(stats.cacheCreationTokens), columns)}
      {heading(ui, 'Cost and limits')}
      {field(ui, 'Cost (estimate)', `${formatUsd(usage.costUsd)}${usage.hasUnknownPrice ? ', some prices unknown' : ''}`, columns)}
      {usage.rateLimits.length === 0 && field(ui, 'Rate limits', 'none reported (only subscriptions report them)', columns)}
      {usage.rateLimits.map(limit =>
        field(
          ui,
          `Limit ${limitLabel(limit.kind)}`,
          `${meter(limit.percentUsed)} ${Math.round(limit.percentUsed)}%${limit.resetsAt ? `, resets ${formatClock(Date.parse(limit.resetsAt))}` : ''}`,
          columns,
          loadColor(limit.percentUsed),
        ),
      )}
    </Box>
  )
}

const EVENT_COLOR: Partial<Record<string, 'error' | 'warning'>> = {
  'tool.error': 'error',
  'tool.denied': 'error',
  'context.alert': 'warning',
  'context.compact': 'warning',
  'loop.alert': 'error',
}

function activity({ ui, state, columns, rows }: View) {
  const { Box, Text } = ui
  const items = state.activity.items
  if (!items.length) return empty(ui, 'No activity yet. Events appear here as the session works.')
  return (
    <Box flexDirection="column">
      <Text dimColor>{fit(`${'#'.padEnd(5)} ${'Time'.padEnd(8)}  ${'Event'.padEnd(15)} Detail`, columns)}</Text>
      {[...items].reverse().slice(0, Math.max(1, rows - 1)).map(event => (
        <Text dimColor={event.type === 'turn.start'} color={EVENT_COLOR[event.type]}>
          {fit(
            `${String(event.sequence).padEnd(5)} ${formatClock(event.timestamp)}  ${event.type.padEnd(15)} ${event.label}${event.agentId ? `  (${event.agentId})` : ''}`,
            columns,
          )}
        </Text>
      ))}
    </Box>
  )
}

function tools({ ui, state, columns }: View) {
  const { Box, Text } = ui
  const list = toolDistribution(state.tools)
  if (!list.length) return empty(ui, 'No tool calls yet. Each tool appears here the first time it runs.')
  const byName = new Map(state.tools.map(tool => [tool.name, tool]))
  const width = Math.min(26, Math.max(4, ...list.map(tool => tool.name.length)))
  const slow = slowestTools(state.tools).slice(0, 5)
  const groups = mcpGroups(state.tools)
  return (
    <Box flexDirection="column" overflowX="scroll">
      <Text dimColor>{fit(`${'Tool'.padEnd(width)}  Runs  Fail  Deny  Share             Avg  Result     Last`, columns)}</Text>
      {list.map(share => {
        const tool = byName.get(share.name)
        const failed = (tool?.errors ?? 0) + (tool?.denials ?? 0) > 0
        return (
          <Text color={failed ? 'error' : undefined}>
            {fit(
              `${fit(mcpServer(share.name) ? share.name.replace(/^mcp__/, '') : share.name, width).padEnd(width)}  ${String(share.executions).padStart(4)}  ${String(tool?.errors ?? 0).padStart(4)}  ${String(tool?.denials ?? 0).padStart(4)}  ${meter(share.share * 100)} ${String(Math.round(share.share * 100)).padStart(3)}%  ${formatDuration(tool && tool.totalMs > 0 ? tool.totalMs / tool.executions : undefined).padStart(6)}  ${formatTokens(tool?.resultTokens).padStart(6)}  ${formatClock(tool?.lastExecution)}`,
              columns,
            )}
          </Text>
        )
      })}
      {slow.length > 0 && heading(ui, 'Slowest on average')}
      {slow.map(tool => (
        <Text>{fit(`${fit(tool.name, width).padEnd(width)}  avg ${formatDuration(tool.averageMs)}  longest ${formatDuration(tool.maxMs)}`, columns)}</Text>
      ))}
      {groups.length > 0 && heading(ui, 'MCP servers')}
      {groups.map(group => (
        <Text>{fit(`${fit(group.server, width).padEnd(width)}  ${String(group.executions).padStart(4)} calls  ${group.tools.join(', ')}`, columns)}</Text>
      ))}
    </Box>
  )
}

function agents({ ui, state, now, columns }: View) {
  const { Box, Text } = ui
  if (!state.agents.length) return empty(ui, 'No subagents in this session. Each one appears here when Claude starts it.')
  return (
    <Box flexDirection="column">
      {[...state.agents].reverse().map(agent => (
        <Box flexDirection="column" marginBottom={1}>
          <Text color={agent.status === 'running' ? 'success' : agent.status === 'failed' ? 'error' : undefined} bold>
            {fit(`${agent.type}  ${agent.status}`, columns)}
          </Text>
          <Text>{fit(agent.description || '—', columns)}</Text>
          <Text dimColor>
            {fit(
              `${agent.turns} turns   ${agent.toolCalls} tool calls   ${formatDuration(agent.durationMs ?? (agent.endedAt ?? now) - agent.startedAt)}${agent.model ? `   ${agent.model}` : ''}   ${agent.id}`,
              columns,
            )}
          </Text>
          {agent.tools.length > 0 && <Text dimColor>{fit(`Tools: ${agent.tools.join(', ')}`, columns)}</Text>}
        </Box>
      ))}
    </Box>
  )
}

function files({ ui, state, columns }: View) {
  const { Box, Text } = ui
  const { git } = state
  const list = [...state.files].sort((a, b) => b.lastAt - a.lastAt)
  return (
    <Box flexDirection="column">
      {field(ui, 'Lines changed', git.isRepo ? (git.checkedAt === undefined ? 'counted after the next turn' : `+${git.added}  −${git.removed}`) : 'not a git repository', columns)}
      {git.isRepo && git.checkedAt !== undefined && field(ui, 'Files changed', `${git.files} since the session began`, columns)}
      {heading(ui, 'Files touched by tools')}
      {list.length === 0 && empty(ui, 'No file read or edited yet.')}
      {list.length > 0 && <Text dimColor>{fit(`${'Reads'.padStart(5)}  ${'Edits'.padStart(5)}  ${'Last'.padEnd(8)}  Path`, columns)}</Text>}
      {list.map(file => (
        <Text color={file.edits ? 'diffAdded' : undefined}>
          {fit(`${String(file.reads).padStart(5)}  ${String(file.edits).padStart(5)}  ${formatClock(file.lastAt)}  ${file.path}`, columns)}
        </Text>
      ))}
    </Box>
  )
}

function system({ ui, state, columns }: View) {
  const { Box, Text } = ui
  const { system: host, speed, wifi } = state
  return (
    <Box flexDirection="column">
      {field(ui, 'CPU', host.cpuPercent === undefined ? 'measured from the second sample' : `${host.cpuPercent}% of one core`, columns, host.cpuPercent === undefined ? undefined : loadColor(host.cpuPercent))}
      {field(ui, 'Memory', formatBytes(host.memoryBytes), columns)}
      {field(ui, 'Processes', host.processes === undefined ? '—' : `${host.processes} in the Claude Code tree`, columns)}
      {field(ui, 'Sampled at', formatClock(host.sampledAt), columns)}
      {field(ui, 'CPU history', sparkline(host.cpuHistory.map(value => Math.min(100, value))) || '—', columns)}
      {heading(ui, 'Model speed')}
      {field(ui, 'Last request', speed.tokensPerSecond === undefined ? '—' : `${speed.tokensPerSecond} tokens/s`, columns)}
      {field(ui, 'History', speed.history.length ? speed.history.join('  ') : '—', columns)}
      {heading(ui, 'Wi-Fi')}
      {field(ui, 'Download', wifi.hasAdapter === false ? 'off' : formatRate(wifi.downBytesPerSecond), columns)}
      {field(ui, 'Upload', wifi.hasAdapter === false ? 'off' : formatRate(wifi.upBytesPerSecond), columns)}
      {field(ui, 'Sampled at', formatClock(wifi.sampledAt), columns)}
      <Text dimColor>{fit('CPU and memory cover Claude Code and the tools it started, sampled at most every 10 seconds.', columns)}</Text>
      <Text dimColor>{fit("Wi-Fi covers the whole computer's traffic, sampled every 5 seconds.", columns)}</Text>
    </Box>
  )
}

const SECTIONS: Record<InspectorTab, (view: View) => ReturnType<typeof empty>> = {
  overview,
  context,
  sessions,
  activity,
  tools,
  agents,
  files,
  system,
}

function tabBar($: Engine, ui: Ui, active: InspectorTab) {
  const { Box, Button, Text } = ui
  return (
    <Box flexDirection="row" flexWrap="wrap" columnGap={2} marginBottom={1}>
      {TABS.map((tab, index) => (
        <Button key={`tab-${tab}`} plain hotkey={String(index + 1)} onPress={() => setTab($, tab)}>
          {tab === active ? (
            <Text bold color="claude">
              {TAB_LABEL[tab]}
            </Text>
          ) : (
            <Text dimColor>{TAB_LABEL[tab]}</Text>
          )}
        </Button>
      ))}
    </Box>
  )
}

// The items loaded on every turn, largest first: memory files, MCP servers' tool schemas, the skill listing, agent types.
export function fixedCosts(breakdown: SessionContextBreakdown): TokenShare[] {
  const servers = new Map<string, number>()
  for (const tool of breakdown.mcpTools) servers.set(tool.serverName, (servers.get(tool.serverName) ?? 0) + tool.tokens)
  return [
    ...breakdown.memoryFiles.map(file => ({ name: `Memory ${file.path.replace(/\\/g, '/').split('/').slice(-2).join('/')}`, tokens: file.tokens })),
    ...[...servers].map(([server, tokens]) => ({ name: `MCP ${server}`, tokens })),
    ...(breakdown.skills ? [{ name: 'Skill listing', tokens: breakdown.skills.tokens }] : []),
    ...breakdown.agents.map(agent => ({ name: `Agent ${agent.agentType}`, tokens: agent.tokens })),
  ]
    .filter(share => share.tokens > 0)
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, FIXED_COSTS)
}

// What fills the window, estimated locally with no request; undefined when the engine cannot say.
async function contextBreakdown($: Engine): Promise<BreakdownView | undefined> {
  try {
    const breakdown = (await $.session.usage({ breakdown: 'summary' })).context.breakdown
    if (!breakdown) return undefined
    const categories = breakdown.categories
      .filter(category => category.kind === 'used' && category.tokens > 0)
      .map(category => ({ name: category.name, tokens: category.tokens }))
    return { categories, fixed: fixedCosts(breakdown) }
  } catch {
    return undefined
  }
}

export function registerInspectorPane(on: On): void {
  on('ui.render', { component: 'Pane', requestId: PANE_ID }, async ($, e) => {
    const ui: Ui = $.ui.resolve(e)
    const [state, now] = await Promise.all([readState($), $.clock.now()])
    const breakdown = state.tab === 'context' ? await contextBreakdown($) : undefined
    const columns = e.props.bodyColumns
    const rows = Math.max(3, (e.props.scroll.bodyRows ?? 20) - 3)
    const { Box } = ui
    return (
      <Box flexDirection="column">
        {tabBar($, ui, state.tab)}
        {SECTIONS[state.tab]({ ui, state, now, columns, rows, breakdown })}
      </Box>
    )
  })
}
