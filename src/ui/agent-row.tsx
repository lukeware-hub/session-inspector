import type { On } from 'claude-code'

// One distinct hue per agent row, readable on dark and light terminals; no violet, no red (red means failure).
export const AGENT_COLORS = ['#22c55e', '#f59e0b', '#3b82f6', '#ec4899', '#06b6d4', '#84cc16', '#f97316'] as const

const ACTIVE = new Set(['pending', 'running', 'waiting'])

// The agent's color: its place among the rows the list shows, so rows side by side never share one.
export function agentColor(id: string, rowIds: readonly string[]): string {
  const index = Math.max(0, rowIds.indexOf(id))
  return AGENT_COLORS[index % AGENT_COLORS.length] ?? AGENT_COLORS[0]
}

// A filled mark while the agent works, a hollow one once it stops.
export function agentMark(status: string): string {
  return ACTIVE.has(status) ? '●' : '○'
}

// Puts a colored mark before each agent row, keeping the row Claude Code draws.
export function registerAgentRow(on: On): void {
  on('ui.render', { component: 'AgentRow' }, async ($, e, next) => {
    if (e.props.isHidden) return next(e)
    const row = await next(e)
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="row">
        <Text color={agentColor(e.props.id, e.props.rowIds)} bold>
          {`${agentMark(e.props.status)} `}
        </Text>
        {row}
      </Box>
    )
  })
}
