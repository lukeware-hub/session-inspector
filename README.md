# Session Inspector

Native Developer Observability Dashboard for Claude Code.

Session Inspector is a Claude Code mod (a plugin of function hooks) that watches the current session and shows what is happening in it: how full the context window is, what the session costs, which tools ran and how long they took, which subagents worked, which files were touched, how many lines changed, and how much CPU and memory Claude Code uses. It draws with Claude Code's own interface elements, in the terminal and in the desktop app, with no web page, no server and no network access.

## Features

- **Footer band**: a framed panel fixed right above the prompt, always visible:

  ```
  ╭──────────────────────────────────────────────────────────────────────╮
  │ Session Inspector                       claude-opus-5-5   ● running  │
  │ Context  ▰▰▰▰▰▰▱▱▱▱ 62%   124k / 200k   Normal                       │
  │ Session  15m 02s   8 turns   34 tools   2 agents   $8.40   +127   −34│
  │ System   CPU 4%   RAM 512 MB   69 tok/s   5h 38%   7d 12%            │
  ╰──────────────────────────────────────────────────────────────────────╯
  ```

  When the band has less than five rows of room it drops the frame and keeps the rows.
- **Inspector pane**: opened with `/inspector`, with eight sections you switch with the buttons or the keys 1 to 8:
  - **Overview**: status, model, context usage and window, tokens used, turns, tool calls, subagents, cost, lines changed, speed, CPU and memory, duration, last activity and event count.
  - **Context**: tokens in context, window size, tokens available, level, compactions, what fills the window (system prompt, tools, memory, messages), and the last 12 readings.
  - **Session**: session id, status, start and end time, duration, turns, tool calls, model, token totals, cost and rate limits.
  - **Activity**: the last 50 events (session start and end, turns, tool calls, failures, denials, subagents, alerts, compactions).
  - **Tools**: every tool that actually ran, with runs, failures, permission denials, share of all calls, average time and last use; the slowest tools; MCP calls grouped by server.
  - **Agents**: every subagent the session started, with type, status, task, turns, tool calls, duration, model and tools used.
  - **Files**: lines added and removed since the session began, and the files tools read or edited.
  - **System**: CPU and memory of the Claude Code process tree, and model speed in tokens per second.
- **Context alerts**: a notification when context usage rises into High (85% or more) or Critical (95% or more).

Context levels: Normal from 0% to 69%, Attention from 70% to 84%, High from 85% to 94%, Critical from 95% to 100%.

Only real data from the session is shown. A value Claude Code has not reported yet is shown as `—`, never guessed.

## Requirements

- Claude Code 2.1.327 or newer (the version whose mod interface this release is built and tested against).

## Install

You need Claude Code installed.

**In the Claude Code terminal**, type at the prompt:

```
/plugin install session-inspector --marketplace lukeware-hub/session-inspector
```

1. Answer `y` to add the marketplace.
2. Press Enter to install for your user (all your projects).
3. Done: the Session Inspector band appears above the prompt, and `/inspector` opens the pane.

**From a shell**, the same in one line:

```
claude plugin install session-inspector --marketplace lukeware-hub/session-inspector
```

**In the Claude desktop app**: click **+** next to the prompt box, then **Plugins**, **Add marketplace**, type `lukeware-hub/session-inspector`, then **Add plugin**.

To try it from a local copy without installing:

```
claude --plugin-dir .
```

## Uninstall

```
/plugin uninstall session-inspector
```

## Configuration

None. The mod has no settings.

## Commands

| Command | What it does |
| --- | --- |
| `/inspector` | Opens the inspector pane on the section shown last. |
| `/inspector <section>` | Opens the pane on one section: `overview`, `context`, `sessions`, `activity`, `tools`, `agents`, `files` or `system`. |

Where the pane is drawn is up to Claude Code: in the terminal's main screen it opens inline right above the prompt; in the fullscreen layout it docks beside the transcript. The footer band is always above the prompt, and `ctrl+x ctrl+a` collapses or expands it.

## Examples

```
/inspector context
```

Opens the Context section: a progress bar of the window in use, its level, and the last readings.

```
/inspector tools
```

Opens the Tools section: each tool that ran in this session with its number of runs and errors.

## Privacy and security

The mod only observes. It never changes a prompt, a response, a tool call or a permission, never blocks a tool and never approves anything. It keeps only names, ids, counts, times, token figures and the paths of files tools read or edited, in the session's memory: never other tool arguments, file contents, prompts or model answers. To count changed lines and measure CPU and memory it runs two kinds of read-only local command: `git rev-parse` and `git diff --numstat`, and the operating system's process list (`ps`, or PowerShell on Windows). Nothing is written to disk or sent anywhere. See [SECURITY.md](SECURITY.md).

## Development

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md). In short:

```
npm install
npm run check
```

The architecture is described in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), the product in [docs/PRD.md](docs/PRD.md) and the plan in [docs/ROADMAP.md](docs/ROADMAP.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE).
