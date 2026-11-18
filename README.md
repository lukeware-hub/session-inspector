# Session Inspector

Native Developer Observability Dashboard for Claude Code.

Session Inspector is a Claude Code mod (a plugin of function hooks) that watches the current session and shows what is happening in it: how full the context window is, what the session costs, which tools ran and how long they took, which subagents worked, which files were touched, how many lines changed, and how much CPU and memory Claude Code uses. It draws with Claude Code's own interface elements, in the terminal and in the desktop app, with no web page, no server and no network access.

## Features

- **Footer band**: a framed panel fixed right above the prompt, always visible:

  ```
  ╭───────────────────────────────────────────────────────────────────────────────────────╮
  │ Session Inspector                          claude-opus-5-5   effort high   ● running  │
  │ Context  used ████░░░░░░ 45%   tokens 454k / 1M   level Normal                        │
  │ Session  time 1h 14m   subagents 2 running of 5   turns 8   tools 82   cost $19.35      │
  │ System   CPU █░░░░░░░░░ 5%   RAM 713 MB   speed 99 tok/s   wifi ↓ 171 Kbps ↑ 75 Kbps  │
  │ Limits   5h ██░░░░░░░░ 16%   7d ░░░░░░░░░░ 3%                                         │
  ╰───────────────────────────────────────────────────────────────────────────────────────╯
  ```

  Every figure has a label, every percentage uses the same ten-cell scale, the header shows the effort of the last request, and the Session row counts the subagents working right now. The Limits row appears when the account reports rate limits. When the band has less than five rows of room it drops the frame and keeps the rows.
- **Inspector pane**: opened with `/inspector`, with eight sections you switch with the buttons or the keys 1 to 8:
  - **Overview**: status, model, context usage and window, tokens used, turns, tool calls, subagents, cost, lines changed, speed, CPU and memory, duration, last activity and event count.
  - **Context**: tokens in context, window size, tokens available, level, where auto-compaction runs, growth per turn and turns left, compactions, what fills the window (system prompt, tools, memory, messages), what loads on every turn (memory files, MCP servers, skills, agents), the largest tool results, and the last 12 readings.
  - **Session**: session id, status, start and end time, duration, turns, tool calls, model, token totals, cost and rate limits.
  - **Activity**: the last 50 events (session start and end, turns, tool calls, failures, denials, subagents, alerts, compactions).
  - **Tools**: every tool that actually ran, with runs, failures, permission denials, share of all calls, average time, the size of its results and last use; the slowest tools; MCP calls grouped by server.
  - **Agents**: every subagent the session started, with type, status, task, turns, tool calls, duration, model and tools used.
  - **Files**: lines added and removed since the session began, and the files tools read or edited.
  - **System**: CPU and memory of the Claude Code process tree, model speed in tokens per second, and the computer's Wi-Fi download and upload.
- **Wi-Fi traffic**: the band's System row shows how many Kbps (kilobits per second, 1 Kbps = 1000 bits/s) the computer's Wi-Fi receives and sends, read every 5 seconds; it says `off` when no Wi-Fi adapter is up.
- **Agent list colors**: each row of the agent list under the prompt gets a mark of its own color, filled while the agent works and hollow once it stops, so several subagents are told apart at a glance.
- **Context alerts**: a notification when context usage rises into High (85% or more) or Critical (95% or more).
- **Context forecast**: the band says how many turns are left before auto-compaction (or a full window) at the pace of the last turns, in amber from three turns and in red on the last one.
- **Loop detector**: a notification, and a red line in the band, when the same call repeats four times within three minutes or three calls fail in a row, so a stuck agent is caught before it burns tokens.

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

The mod only observes. It never changes a prompt, a response, a tool call or a permission, never blocks a tool and never approves anything. It keeps only names, ids, counts, times, token figures and the paths of files tools read or edited, in the session's memory: never other tool arguments, file contents, prompts or model answers. To count changed lines, measure CPU and memory, and measure Wi-Fi traffic it runs three kinds of read-only local command: `git rev-parse` and `git diff --numstat`, the operating system's process list (`ps`, or PowerShell on Windows), and the Wi-Fi adapter's byte counters. Nothing is written to disk or sent anywhere. See [SECURITY.md](SECURITY.md).

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
