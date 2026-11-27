export type CodeLines = { added: number; removed: number }

type Hunk = { lines?: unknown }

// The lines a diff adds and removes, counted from each hunk's `+` and `-` lines, as /usage does.
export function patchLines(patch: unknown): CodeLines {
  const counted = { added: 0, removed: 0 }
  if (!Array.isArray(patch)) return counted
  for (const hunk of patch as Hunk[]) {
    if (!hunk || !Array.isArray(hunk.lines)) continue
    for (const line of hunk.lines) {
      if (typeof line !== 'string') continue
      if (line.startsWith('+')) counted.added += 1
      else if (line.startsWith('-')) counted.removed += 1
    }
  }
  return counted
}

const EDIT_TOOLS = new Set(['Edit', 'MultiEdit', 'Write'])

// The lines a file tool changed, read from its result; undefined for any other tool or result.
// A new file written in one go carries no hunks, so its content's lines count as added.
export function toolLines(tool: string, result: unknown): CodeLines | undefined {
  if (!EDIT_TOOLS.has(tool) || !result || typeof result !== 'object') return undefined
  const { structuredPatch, type, content } = result as { structuredPatch?: unknown; type?: unknown; content?: unknown }
  const counted = patchLines(structuredPatch)
  const isEmpty = counted.added === 0 && counted.removed === 0
  if (isEmpty && type === 'create' && typeof content === 'string' && content) {
    return { added: content.split('\n').length - (content.endsWith('\n') ? 1 : 0), removed: 0 }
  }
  return counted
}
