import type { Elements, ThemeKey } from 'claude-code'

import { fit } from '../domain/formatters'
import { compactionLimit, forecastTurns } from '../domain/insights'
import type { ContextLevel, InspectorState, SessionStatus } from '../domain/models'

// The elements every surface draws that the inspector uses.
export type Ui = Pick<Elements[keyof Elements], 'Box' | 'Text' | 'Button' | 'Progress'>

export const LEVEL_COLOR: Record<ContextLevel, ThemeKey> = {
  normal: 'success',
  attention: 'warning',
  high: 'warning',
  critical: 'error',
}

// A limit or load figure colored like the context levels: watch from 70%, danger from 95%.
export function loadColor(percent: number): ThemeKey | undefined {
  if (percent >= 95) return 'error'
  if (percent >= 70) return 'warning'
  return undefined
}

export const STATUS_MARK: Record<SessionStatus, { glyph: string; color?: ThemeKey }> = {
  running: { glyph: '●', color: 'success' },
  idle: { glyph: '○' },
  ended: { glyph: '■' },
}

// How many turns the context has left at its recent pace, worded and colored; undefined until it can be told.
export function forecastSegment(state: InspectorState): Segment | undefined {
  const reading = state.contextReadings.at(-1)
  if (!reading) return undefined
  const isCompaction = Boolean(state.pressure.isAutoCompact && state.pressure.threshold)
  const { turnsLeft } = forecastTurns(state.pressure.turnTokens, reading.tokens, compactionLimit(state.pressure, reading.window))
  if (turnsLeft === undefined) return undefined
  const target = isCompaction ? 'compaction' : 'a full window'
  const text = turnsLeft <= 1 ? `${target} next turn` : `≈${turnsLeft} turns to ${target}`
  return { text, color: turnsLeft <= 1 ? 'error' : turnsLeft <= 3 ? 'warning' : undefined, dim: turnsLeft > 3 }
}

// Ten cells of ▰ and ▱, filled to the percent.
export function meter(percent: number, cells = 10): string {
  const filled = Math.round((Math.min(100, Math.max(0, percent)) / 100) * cells)
  return '▰'.repeat(filled) + '▱'.repeat(cells - filled)
}

// A piece of one line: its text, and how it is painted.
export type Segment = { text: string; color?: ThemeKey; bold?: boolean; dim?: boolean }

export const GAP = '   '

// Keeps whole segments, in order, while they fit in `columns`, three spaces apart.
export function fitSegments(segments: readonly Segment[], columns: number): Segment[] {
  const kept: Segment[] = []
  let used = 0
  for (const segment of segments) {
    const cost = (kept.length ? GAP.length : 0) + segment.text.length
    if (used + cost > columns) break
    if (kept.length) kept.push({ text: GAP })
    kept.push(segment)
    used += cost
  }
  return kept
}

export function segmentText(ui: Ui, segment: Segment) {
  const { Text } = ui
  return (
    <Text color={segment.color} bold={segment.bold} dimColor={segment.dim}>
      {segment.text}
    </Text>
  )
}

// A labelled row: the label in a fixed column, then the segments that fit.
export function labelledRow(ui: Ui, label: string, segments: readonly Segment[], columns: number, labelWidth: number) {
  const { Box, Text } = ui
  return (
    <Box flexDirection="row">
      <Text dimColor>{label.padEnd(labelWidth)}</Text>
      {fitSegments(segments, columns - labelWidth).map(segment => segmentText(ui, segment))}
    </Box>
  )
}

export const FIELD_WIDTH = 20

// One "label  value" line of the pane, cut to the width.
export function field(ui: Ui, label: string, value: string, columns: number, color?: ThemeKey) {
  const { Box, Text } = ui
  return (
    <Box flexDirection="row">
      <Text dimColor>{label.padEnd(FIELD_WIDTH)}</Text>
      <Text color={color}>{fit(value, Math.max(1, columns - FIELD_WIDTH))}</Text>
    </Box>
  )
}

// A section heading inside the pane, with a blank row above it.
export function heading(ui: Ui, text: string) {
  const { Box, Text } = ui
  return (
    <Box marginTop={1}>
      <Text bold>{text}</Text>
    </Box>
  )
}

export function empty(ui: Ui, text: string) {
  const { Text } = ui
  return <Text dimColor>{text}</Text>
}
