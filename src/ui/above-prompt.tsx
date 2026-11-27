import type { On } from 'claude-code'

import { currentLimit, formatBytes, formatDuration, formatRate, formatTokens, formatUsd, limitLabel } from '../domain/formatters'
import { activeLoopAlert } from '../domain/insights'
import type { InspectorState, WifiRecord } from '../domain/models'
import { activeAgents, sessionDurationMs } from '../domain/reducers'
import { contextLevel, levelLabel } from '../domain/thresholds'
import { readState } from '../state/repository'
import {
  LEVEL_COLOR,
  STATUS_MARK,
  forecastSegment,
  cardRows,
  tableFits,
  tableLines,
  gridLine,
  layoutGrid,
  loadColor,
  meterText,
  type GridRow,
  type Segment,
  type Ui,
} from './components'

export const BAND_LABEL_WIDTH = 9

// A figure with no value yet: its label stays, so the grid keeps its columns.
function missing(label: string, optional = false): Segment {
  return { label, text: '—', dim: true, optional }
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
      forecastSegment(state) ?? missing('forecast', true),
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
  const { agents, usage } = state
  return {
    label: 'Session',
    cells: [
      { label: 'time', text: formatDuration(sessionDurationMs(state.session, now)) },
      subagentsSegment(agents),
      usage.costUsd === undefined ? missing('cost') : { label: 'cost', text: formatUsd(usage.costUsd) },
      // Lines Edit and Write changed, as /usage counts them; the git count is in the pane's Files tab.
      {
        label: 'session code',
        text: `+${usage.linesAdded ?? 0}`,
        color: 'diffAdded',
        more: [{ text: ` −${usage.linesRemoved ?? 0}`, color: 'diffRemoved' }],
        optional: true,
      },
    ],
  }
}

// The computer's Wi-Fi download and upload; "off" when no Wi-Fi adapter is up.
export function wifiSegment(wifi: WifiRecord): Segment {
  if (wifi.hasAdapter === false) return { label: 'wifi', text: 'off', dim: true, optional: true }
  if (wifi.downBytesPerSecond === undefined || wifi.upBytesPerSecond === undefined) return missing('wifi', true)
  return { label: 'wifi', text: `↓ ${formatRate(wifi.downBytesPerSecond)}`, more: [{ text: ` ↑ ${formatRate(wifi.upBytesPerSecond)}` }], optional: true }
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
      speed.tokensPerSecond === undefined ? missing('speed', true) : { label: 'speed', text: `${speed.tokensPerSecond} tok/s`, optional: true },
      wifiSegment(wifi),
    ],
  }
}

// The last row: any rate-limit windows the account reports, then turns and tools.
function limitsRow({ usage, stats }: InspectorState, now: number): GridRow {
  return {
    label: 'Limits',
    cells: [
      ...usage.rateLimits.map(stored => currentLimit(stored, now)).map(limit => ({ label: limitLabel(limit.kind), text: meterText(limit.percentUsed), color: loadColor(limit.percentUsed) })),
      { label: 'turns', text: String(stats.totalTurns) },
      { label: 'tools', text: String(stats.totalToolCalls) },
    ],
  }
}

// A loop alert gets a row of its own, across the whole width, while it is recent.
function alertRow(state: InspectorState, now: number): GridRow | undefined {
  const loop = activeLoopAlert(state.loop, now)
  return loop ? { label: 'Loop', cells: [], span: { text: loop, color: 'error', bold: true } } : undefined
}

// The band's rows, most important first.
export function bandRows(state: InspectorState, now: number): GridRow[] {
  return [contextRow(state), alertRow(state, now), sessionRow(state, now), systemRow(state), limitsRow(state, now)].filter(
    (row): row is GridRow => row !== undefined,
  )
}

export const BAND_MAX_ROWS = 4

// Rows the band shows: the frame and title need five rows of room; below that, bare rows.
export function bandLayout(maxRows: number): { isFramed: boolean; rows: number } {
  if (maxRows >= 5) return { isFramed: true, rows: Math.min(BAND_MAX_ROWS, maxRows - 3) }
  return { isFramed: false, rows: Math.max(1, Math.min(BAND_MAX_ROWS, maxRows)) }
}

export function registerAbovePrompt(on: On): void {
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const ui: Ui = $.ui.resolve(e)
    const { Box, Text } = ui
    const [state, now] = await Promise.all([readState($), $.clock.now()])
    const isDesktop = e.surface === 'desktop'
    const allRows = bandRows(state, now)
    // The desktop always draws cards (the band scrolls past its height). The terminal draws one table with shared lines,
    // two lines a row, when the band has room for it, and the one-line grid otherwise.
    const isTable = !isDesktop && tableFits(e.props.maxRows, allRows.length)
    const isCards = isDesktop || isTable
    const layout = isCards ? { isFramed: isDesktop ? e.props.maxRows >= 5 : true, rows: allRows.length } : bandLayout(e.props.maxRows)
    const columns = e.props.bodyColumns - (layout.isFramed ? 4 : 0)
    const rows = allRows.slice(0, layout.rows)
    const lines = isDesktop
      ? cardRows(ui, rows, columns, BAND_LABEL_WIDTH)
      : (isTable ? tableLines(rows, columns, BAND_LABEL_WIDTH) : layoutGrid(rows, columns, BAND_LABEL_WIDTH)).map(parts => gridLine(ui, parts))
    if (!layout.isFramed) return <Box flexDirection="column">{lines}</Box>

    const mark = STATUS_MARK[state.session.status]
    return (
      <Box flexDirection="column" borderStyle="round" borderDimColor paddingX={1} gap={0}>
        <Box flexDirection="row" justifyContent="space-between" flexWrap={isCards ? 'wrap' : undefined}>
          <Text bold color="claude">
            Session Inspector
          </Text>
          <Box flexDirection="row" columnGap={3} flexWrap={isCards ? 'wrap' : undefined}>
            {state.session.model && <Text dimColor>{state.session.model}</Text>}
            {state.session.effort && <Text dimColor>{`effort ${state.session.effort}`}</Text>}
            <Text color={mark.color} dimColor={!mark.color}>
              {`${mark.glyph} ${state.session.status}`}
            </Text>
          </Box>
        </Box>
        {lines}
      </Box>
    )
  })
}
