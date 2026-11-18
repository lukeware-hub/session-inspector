import type { On } from 'claude-code'

import { formatBytes, formatDuration, formatPercent, formatTokens, formatUsd, limitLabel } from '../domain/formatters'
import type { InspectorState } from '../domain/models'
import { activeLoopAlert } from '../domain/insights'
import { sessionDurationMs } from '../domain/reducers'
import { contextLevel, levelLabel } from '../domain/thresholds'
import { readState } from '../state/repository'
import { LEVEL_COLOR, STATUS_MARK, forecastSegment, labelledRow, loadColor, meter, type Segment, type Ui } from './components'

export const BAND_LABEL_WIDTH = 9

export type BandRow = { label: string; segments: Segment[] }

function contextRow(state: InspectorState): BandRow {
  const reading = state.contextReadings.at(-1)
  if (!reading) return { label: 'Context', segments: [{ text: 'waiting for the first response', dim: true }] }
  const level = contextLevel(reading.percent)
  const color = LEVEL_COLOR[level]
  const forecast = forecastSegment(state)
  return {
    label: 'Context',
    segments: [
      { text: `${meter(reading.percent)} ${formatPercent(reading.percent)}`, color },
      { text: `${formatTokens(reading.tokens)} / ${formatTokens(reading.window)}` },
      { text: levelLabel(level), color, bold: level === 'high' || level === 'critical', dim: level === 'normal' },
      ...(forecast ? [forecast] : []),
    ],
  }
}

function sessionRow(state: InspectorState, now: number): BandRow {
  const { stats, agents, usage, git } = state
  const loop = activeLoopAlert(state.loop, now)
  const segments: Segment[] = [
    ...(loop ? [{ text: `Loop: ${loop}`, color: 'error' as const, bold: true }] : []),
    { text: formatDuration(sessionDurationMs(state.session, now)) },
    { text: `${stats.totalTurns} turns` },
    { text: `${stats.totalToolCalls} tools` },
  ]
  if (agents.length) segments.push({ text: `${agents.length} agents` })
  if (usage.costUsd !== undefined) segments.push({ text: formatUsd(usage.costUsd) })
  if (git.isRepo && git.checkedAt !== undefined) {
    segments.push({ text: `+${git.added}`, color: 'diffAdded' })
    segments.push({ text: `−${git.removed}`, color: 'diffRemoved' })
  }
  return { label: 'Session', segments }
}

function systemRow({ system, speed, usage }: InspectorState): BandRow {
  const segments: Segment[] = []
  if (system.cpuPercent !== undefined) segments.push({ text: `CPU ${system.cpuPercent}%` })
  if (system.memoryBytes !== undefined) segments.push({ text: `RAM ${formatBytes(system.memoryBytes)}` })
  if (speed.tokensPerSecond !== undefined) segments.push({ text: `${speed.tokensPerSecond} tok/s` })
  for (const limit of usage.rateLimits) {
    segments.push({ text: `${limitLabel(limit.kind)} ${Math.round(limit.percentUsed)}%`, color: loadColor(limit.percentUsed) })
  }
  return { label: 'System', segments: segments.length ? segments : [{ text: 'measuring after the first turn', dim: true }] }
}

// The band's rows of figures, most important first.
export function bandRows(state: InspectorState, now: number): BandRow[] {
  return [contextRow(state), sessionRow(state, now), systemRow(state)]
}

// Rows the band shows: the frame and title need five rows of room; below that, bare rows.
export function bandLayout(maxRows: number): { isFramed: boolean; rows: number } {
  if (maxRows >= 5) return { isFramed: true, rows: Math.min(3, maxRows - 3) }
  return { isFramed: false, rows: Math.max(1, Math.min(3, maxRows)) }
}

export function registerAbovePrompt(on: On): void {
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const ui: Ui = $.ui.resolve(e)
    const { Box, Text } = ui
    const [state, now] = await Promise.all([readState($), $.clock.now()])
    const layout = bandLayout(e.props.maxRows)
    const columns = e.props.bodyColumns - (layout.isFramed ? 4 : 0)
    const rows = bandRows(state, now)
      .slice(0, layout.rows)
      .map(row => labelledRow(ui, row.label, row.segments, columns, BAND_LABEL_WIDTH))
    if (!layout.isFramed) return <Box flexDirection="column">{rows}</Box>

    const mark = STATUS_MARK[state.session.status]
    return (
      <Box flexDirection="column" borderStyle="round" borderDimColor paddingX={1}>
        <Box flexDirection="row" justifyContent="space-between">
          <Text bold color="claude">
            Session Inspector
          </Text>
          <Box flexDirection="row" columnGap={3}>
            {state.session.model && <Text dimColor>{state.session.model}</Text>}
            <Text color={mark.color} dimColor={!mark.color}>
              {`${mark.glyph} ${state.session.status}`}
            </Text>
          </Box>
        </Box>
        {rows}
      </Box>
    )
  })
}
