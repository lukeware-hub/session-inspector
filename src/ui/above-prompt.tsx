import type { On } from 'claude-code'

import { formatBytes, formatDuration, formatRate, formatTokens, formatUsd, limitLabel } from '../domain/formatters'
import { activeLoopAlert } from '../domain/insights'
import type { InspectorState, WifiRecord } from '../domain/models'
import { activeAgents, sessionDurationMs } from '../domain/reducers'
import { contextLevel, levelLabel } from '../domain/thresholds'
import { readState } from '../state/repository'
import {
  LEVEL_COLOR,
  STATUS_MARK,
  forecastSegment,
  gridLine,
  layoutGrid,
  loadColor,
  meterText,
  type GridRow,
  type Part,
  type Segment,
  type Ui,
} from './components'

export const BAND_LABEL_WIDTH = 9

// A figure with no value yet: its label stays, so the grid keeps its columns.
function missing(label: string): Segment {
  return { label, text: '—', dim: true }
}

function contextRow(state: InspectorState): GridRow {
  const reading = state.contextReadings.at(-1)
  if (!reading) return { label: 'Context', cells: [], span: { text: 'waiting for the first response', dim: true } }
  const level = contextLevel(reading.percent)
  const color = LEVEL_COLOR[level]
  return {
    label: 'Context',
    cells: [
      { label: 'used', text: meterText(reading.percent), color },
      { label: 'tokens', text: `${formatTokens(reading.tokens)} / ${formatTokens(reading.window)}` },
      { label: 'level', text: levelLabel(level), color, bold: level === 'high' || level === 'critical' },
      forecastSegment(state) ?? missing('forecast'),
    ],
  }
}

// Subagents working right now, out of all this session started; green while any works.
export function subagentsSegment(agents: InspectorState['agents']): Segment {
  const running = activeAgents(agents)
  if (!agents.length) return { label: 'subagents', text: '0 running', dim: true }
  return { label: 'subagents', text: `${running} running of ${agents.length}`, color: running ? 'success' : undefined, bold: running > 0 }
}

function sessionRow(state: InspectorState, now: number): GridRow {
  const { stats, agents, usage, git } = state
  const hasLines = git.isRepo && git.checkedAt !== undefined
  return {
    label: 'Session',
    cells: [
      { label: 'time', text: formatDuration(sessionDurationMs(state.session, now)) },
      subagentsSegment(agents),
      { label: 'turns', text: String(stats.totalTurns) },
      { label: 'tools', text: String(stats.totalToolCalls) },
      usage.costUsd === undefined ? missing('cost') : { label: 'cost', text: formatUsd(usage.costUsd) },
      hasLines
        ? { label: 'lines', text: `+${git.added}`, color: 'diffAdded', more: [{ text: ` −${git.removed}`, color: 'diffRemoved' }] }
        : missing('lines'),
    ],
  }
}

// The computer's Wi-Fi download and upload; "off" when no Wi-Fi adapter is up.
export function wifiSegment(wifi: WifiRecord): Segment {
  if (wifi.hasAdapter === false) return { label: 'wifi', text: 'off', dim: true }
  if (wifi.downBytesPerSecond === undefined || wifi.upBytesPerSecond === undefined) return missing('wifi')
  return { label: 'wifi', text: `↓ ${formatRate(wifi.downBytesPerSecond)}`, more: [{ text: ` ↑ ${formatRate(wifi.upBytesPerSecond)}` }] }
}

function systemRow({ system, speed, wifi }: InspectorState): GridRow {
  if (system.cpuPercent === undefined && system.memoryBytes === undefined && speed.tokensPerSecond === undefined && wifi.sampledAt === undefined) {
    return { label: 'System', cells: [], span: { text: 'measuring after the first turn', dim: true } }
  }
  return {
    label: 'System',
    cells: [
      system.cpuPercent === undefined ? missing('CPU') : { label: 'CPU', text: meterText(system.cpuPercent), color: loadColor(system.cpuPercent) },
      system.memoryBytes === undefined ? missing('RAM') : { label: 'RAM', text: formatBytes(system.memoryBytes) },
      speed.tokensPerSecond === undefined ? missing('speed') : { label: 'speed', text: `${speed.tokensPerSecond} tok/s` },
      wifiSegment(wifi),
    ],
  }
}

// One row for the rate-limit windows, only when the account reports them.
function limitsRow({ usage }: InspectorState): GridRow | undefined {
  if (!usage.rateLimits.length) return undefined
  return {
    label: 'Limits',
    cells: usage.rateLimits.map(limit => ({ label: limitLabel(limit.kind), text: meterText(limit.percentUsed), color: loadColor(limit.percentUsed) })),
  }
}

// A loop alert gets a row of its own, across the whole width, while it is recent.
function alertRow(state: InspectorState, now: number): GridRow | undefined {
  const loop = activeLoopAlert(state.loop, now)
  return loop ? { label: 'Loop', cells: [], span: { text: loop, color: 'error', bold: true } } : undefined
}

// The band's rows, most important first.
export function bandRows(state: InspectorState, now: number): GridRow[] {
  return [contextRow(state), alertRow(state, now), sessionRow(state, now), systemRow(state), limitsRow(state)].filter(
    (row): row is GridRow => row !== undefined,
  )
}

export const BAND_MAX_ROWS = 4

// Rows the band shows: the frame and title need five rows of room; below that, bare rows.
export function bandLayout(maxRows: number): { isFramed: boolean; rows: number } {
  if (maxRows >= 5) return { isFramed: true, rows: Math.min(BAND_MAX_ROWS, maxRows - 3) }
  return { isFramed: false, rows: Math.max(1, Math.min(BAND_MAX_ROWS, maxRows)) }
}

const BAND_TITLE = 'Session Inspector'
const HEADER_GAP = 3

// The header's right-hand facts: model, effort of the last request and status.
export function headerFacts(session: InspectorState['session']): Part[] {
  const mark = STATUS_MARK[session.status]
  const facts: (Part | undefined)[] = [
    session.model ? { text: session.model, dim: true } : undefined,
    session.effort ? { text: `effort ${session.effort}`, dim: true } : undefined,
    { text: `${mark.glyph} ${session.status}`, color: mark.color, dim: !mark.color },
  ]
  return facts.filter((part): part is Part => part !== undefined)
}

function lineWidth(parts: readonly Part[]): number {
  return parts.reduce((sum, part) => sum + part.text.length, 0)
}

// The header spans the grid so its last fact ends with the last column; never narrower than its own text.
export function headerWidth(grid: readonly Part[][], facts: readonly Part[], columns: number): number {
  const own = BAND_TITLE.length + HEADER_GAP * facts.length + lineWidth(facts)
  return Math.min(columns, Math.max(own, ...grid.map(lineWidth)))
}

export function registerAbovePrompt(on: On): void {
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const ui: Ui = $.ui.resolve(e)
    const { Box, Text } = ui
    const [state, now] = await Promise.all([readState($), $.clock.now()])
    const layout = bandLayout(e.props.maxRows)
    const columns = e.props.bodyColumns - (layout.isFramed ? 4 : 0)
    const grid = layoutGrid(bandRows(state, now).slice(0, layout.rows), columns, BAND_LABEL_WIDTH)
    const lines = grid.map(parts => gridLine(ui, parts))
    if (!layout.isFramed) return <Box flexDirection="column">{lines}</Box>

    const facts = headerFacts(state.session)
    return (
      <Box flexDirection="column" borderStyle="round" borderDimColor paddingX={1}>
        <Box flexDirection="row" justifyContent="space-between" width={headerWidth(grid, facts, columns)}>
          <Text bold color="claude">
            {BAND_TITLE}
          </Text>
          <Box flexDirection="row" columnGap={HEADER_GAP}>
            {facts.map(fact => (
              <Text color={fact.color} dimColor={fact.dim}>
                {fact.text}
              </Text>
            ))}
          </Box>
        </Box>
        {lines}
      </Box>
    )
  })
}
