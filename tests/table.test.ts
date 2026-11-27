import { expect, test } from 'claude-code/testing'

import { tableLines, type GridRow } from '../src/ui/components'

const ROWS: GridRow[] = [
  { label: 'Context', cells: [{ label: 'used', text: '██░░░░░░░░  20%' }, { label: 'tokens', text: '196k / 1M' }, { label: 'level', text: 'Normal' }, { label: 'forecast', text: '≈416 turns', optional: true }] },
  { label: 'Loop', cells: [], span: { text: 'Bash failed 3 times in a row' } },
  { label: 'Limits', cells: [{ label: 'turns', text: '2' }, { label: 'tools', text: '4' }] },
]

const text = (line: { text: string }[]) => line.map(part => part.text).join('')

test('the table fills the width exactly, two lines a row plus its bottom line', () => {
  const lines = tableLines(ROWS, 120, 9)
  expect(lines).toHaveLength(2 * ROWS.length + 1)
  for (const line of lines) expect(text(line)).toHaveLength(120)
})

test('neighbouring cells share one line, and a span row closes the junctions around it', () => {
  const lines = tableLines(ROWS, 120, 9).map(text)
  expect(lines[0]?.trim()).toMatch(/^╭─+┬.*╮$/)
  expect(lines[1]).toMatch(/^Context  │ used ██░░░░░░░░  20%\s+│ tokens 196k \/ 1M\s+│/)
  expect(lines[2]?.trim()).toMatch(/^├─+┴.*┤$/)
  expect(lines[2]).not.toContain('┼')
  expect(lines[4]?.trim()).toMatch(/^├─+┬.*┤$/)
  expect(lines[6]?.trim()).toMatch(/^╰─+┴.*╯$/)
})

test('every row puts its column lines at the same place', () => {
  const lines = tableLines(ROWS, 120, 9).map(text)
  const bars = (line: string) => [...line].flatMap((char, index) => ('│┼┬┴'.includes(char) ? [index] : []))
  expect(bars(lines[1] ?? '')).toEqual(bars(lines[5] ?? ''))
  expect(bars(lines[0] ?? '').slice(0, 3)).toEqual(bars(lines[1] ?? '').slice(1, 4))
})

test('a narrow band drops the optional figures and then whole columns from the right', () => {
  const wide = tableLines(ROWS, 120, 9).map(text).join('\n')
  expect(wide).toContain('forecast')
  const narrow = tableLines(ROWS, 60, 9).map(text)
  expect(narrow.join('\n')).not.toContain('forecast')
  for (const line of narrow) expect(line.length).toBeLessThanOrEqual(60)
})
