# Architecture

Session Inspector is a Claude Code mod: a plugin whose behaviour lives in one hooks module, `hooks/register.tsx`, that Claude Code loads in an environment of its own, with no DOM and no Node. Everything outside the module is reached through the engine interface `$` that every hook receives.

## Layers

| Layer | Files | Role |
| --- | --- | --- |
| Event layer | `hooks/register.tsx` | Registers every hook with Claude Code and runs the session start work. |
| Collectors | `src/collectors/*.collector.ts` | Turn Claude Code events into calls on the domain functions and the repository. |
| Domain layer | `src/domain/*.ts` | Pure functions and types: thresholds, counters, history limits, formatting. |
| State layer | `src/state/repository.ts`, `src/state/keys.ts` | The only place that reads and writes the session state. |
| UI layer | `src/ui/*.tsx` | Draws the footer band and the pane from a snapshot of the state. |
| Command layer | `src/commands/inspector.command.ts` | Registers `/inspector` and opens the pane. |

Collectors never draw, and the interface never collects: both meet only in the state.

## Event flow

```
Claude Code event ──> collector hook ──> domain function ──> repository ($.state) ──> redraw of every reader
                           │
                           └──> next(e): the event goes on unchanged
```

| Claude Code event | Collector | What it records |
| --- | --- | --- |
| `session.start` | event layer | Registers `/inspector`, binds the state to the session id, takes the first context reading. |
| `session.measure` | context | A context reading when the fill moved, an alert when the level rises into High or Critical, and the cost estimate and rate limits when they moved. |
| `turn.start` | session | A main turn (status running) or a subagent turn; a new session id after `/clear` starts the values over. |
| `turn.complete` | session | Token usage, the end of a main turn (status idle) or the finish of a subagent; after a main turn, a git line count and a CPU and memory sample in the background. |
| `turn.step` | speed | Output tokens per second of each model request. |
| `session.compact` | speed | A compaction that took place, with its trigger. |
| `session.end` | session | The end of the session and its reason. |
| `tool.call` | tools | The tool's name, its count, the calling agent, the file path for file tools, and after it ran its duration and whether it failed or was denied, then the size of its result and a fingerprint of the call for the loop detector. |
| `agent.spawn` | agents | The agent the engine started, with the id, type and model it reports. |

Every hook returns what `next(e)` returns and is registered with `.catch(($, e, next) => next(e))`, so a failure inside the mod leaves the event to the rest of the chain.

The insights collector (`src/collectors/insights.collector.ts`) adds what helps a developer act: the context size at the end of each main turn and the auto-compaction threshold (from a local `/context` estimate), the largest tool results, and the loop detector. Its rules are pure functions in `src/domain/insights.ts`.

The host collector (`src/collectors/host.collector.ts`) runs read-only local commands through `$.process.run`: `git` for line counts, the process list for CPU and memory, and the Wi-Fi byte counters on a 5-second `$.clock.every` timer started at `session.start` (see [SECURITY.md](../SECURITY.md)). It runs beside the event, never awaited by it, and its failures are dropped. The parsing is pure and lives in `src/domain/host.ts` and `src/domain/wifi.ts`.

## State

The state lives in Claude Code's session state (`$.state`), declared in the contract `types/index.d.ts`. It is split into fifteen values (`pressure`, `results` and `loop` hold the insights): `session`, `context`, `activity`, `stats`, `tools`, `agents`, `usage`, `files`, `git`, `speed`, `system` and `tab`.

- Each value is an atom from the state library (`atom`, `read`, `update` from `claude-code`). `update` reads, applies a pure function and writes with a version check, retrying on a conflict, so two events never overwrite each other.
- Every value except `tab` carries a `shape` tag. A value stored under another tag, by an older version of the mod, is read as empty instead of breaking the new code.
- The state survives a hot reload; module variables do not, so the mod has none.
- `session.start` runs again on every reload: the repository keeps the values while the session id is the same, and starts them over when it changes.
- Claude Code's validator reads a state value only in the file that uses it, so `repository.ts` holds every atom and exposes one function per value.

## Interface

- **Footer band**: a `ui.render` hook on the `AbovePrompt` component. It draws a rounded frame with the title, model, effort and status, then up to four labelled rows (Context, Session, System, Limits) whose figures each carry a label, each fitted to the width by dropping whole figures from the end. With less than five rows of room it drops the frame. It stays out of the way of a survey. Its look is described in [DESIGN.md](../DESIGN.md).
- **Agent rows**: a `ui.render` hook on the `AgentRow` component puts a colored mark before each row of the agent list and keeps the row Claude Code draws (`src/ui/agent-row.tsx`). The engine's own bullet cannot be recolored, so the mark sits beside it.
- **Pane**: a `ui.render` hook on the `Pane` component with the id `session-inspector`, opened by `$.ui.open` with a requested height so that, inline, every section fits. A row of buttons with hotkeys 1 to 8 switches the section, stored in the `tab` value.
- Colors are theme keys (`claude`, `success`, `warning`, `error`, `diffAdded`, `diffRemoved`), so the mod follows the person's theme, dark or light.
- Every element comes from `$.ui.resolve(e)`, the table of the surface that draws, so the same tree draws on the terminal and the desktop app.

## Technical decisions

- **One mod, no runtime dependency.** The module uses only what Claude Code provides.
- **Name `session-inspector`.** Claude Code reserves plugin names that start with `claude-`.
- **The hooks module is `register.tsx`.** The interface is written in JSX, which only `.tsx` files may hold.
- **The state contract is `types/index.d.ts`.** Claude Code's validator checks every state value against the file `plugin.json` names under `types`.
- **Context tokens and session tokens are kept apart.** The context reading is the input of the last response; the session total is the sum of every turn's usage.
- **CPU and memory come from the host, not from Claude Code.** The mod interface has no resource figures, so the mod reads the operating system's process list and sums the Claude Code process tree it runs under.
- **Agents are recorded only from `agent.spawn`.** An agent the mod never saw start is never invented, even if a later event names it.

## Limitations of 0.1.0

- A subagent's duration is known only once its turn completes.
- CPU and memory are sampled at most every 10 seconds and only around turns and `/inspector`, so an idle session shows its last sample.
- Lines changed count tracked files; new files git does not track yet are not counted.
- A pane opened in the fullscreen layout docks beside the transcript; only the footer band is always above the prompt.
