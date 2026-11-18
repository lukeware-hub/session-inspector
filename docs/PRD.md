# Product Requirements: Session Inspector 0.1.0

## Vision

A developer using Claude Code sees, at any moment and without leaving the session, how full the context window is, what the session has done, which tools ran and which subagents worked, drawn with Claude Code's own interface.

## Goals

- Show the state of the context window early enough to act before it fills up.
- Make the work of a session visible: turns, tool calls, subagents and the order of events.
- Stay out of the way: no setup, no web page, no effect on how Claude Code behaves.

## Target audience

- Developers who run long Claude Code sessions and need to watch the context window.
- Developers who build with subagents and want to see what each one did.
- Plugin authors who want to see which events a session raises.

## Functional requirements

1. A framed footer band above the prompt shows the title, the model and the session status, then context usage with its level, tokens in context over the window size, duration, turns, tool calls, agents, cost, lines changed, CPU, memory, speed and rate limits; the level word is colored from Attention up.
2. The command `/inspector` opens a pane; `/inspector <section>` opens it on one section.
3. The pane has eight sections reachable by button and by the keys 1 to 8: Overview, Context, Session, Activity, Tools, Agents, Files and System.
4. Overview shows session status, current model, context usage, context window, tokens used in the session, total turns, total tool calls, subagent activity, session duration, last activity and total events.
5. Context shows tokens in context, window size, percentage, tokens available, level, a history of the last 12 readings and the readings themselves.
6. Context levels are Normal from 0% to 69%, Attention from 70% to 84%, High from 85% to 94% and Critical from 95% to 100%.
7. A notification appears once each time usage rises into High or into Critical.
8. Tokens in context (the input of the last response) and tokens used in the session (the sum over every turn) are shown apart and never mixed.
9. Sessions shows session id, status, start time, end time, duration, total turns, total tool calls, current model and session activity.
10. Activity shows the last 50 events, each with sequence number, type, label, time, tool name when it is a tool call and agent id when an agent raised it.
11. Tools lists only the tools that actually ran, with runs, errors, share of all calls and last use.
12. Agents lists only the subagents the session actually started, with id, type, status, turns, tool calls, duration, model and tools used.
13. Session shows token totals, the cost estimate and each rate-limit window with its use and reset time.
14. Tools shows each tool's permission denials and average time, the slowest tools, and MCP calls grouped by server.
15. Context shows what fills the window and how many compactions happened.
16. Files shows the files tools read or edited and the lines added and removed since the session began, in a git repository.
17. System shows CPU and memory of the Claude Code process tree and the model's speed in tokens per second.
18. After a `/clear`, the next turn starts every value over for the new session.
19. A hot reload of the mod keeps the values of the current session.

## Non-functional requirements

- The mod never changes, blocks or approves anything, and a failure inside it never stops the session.
- It keeps no tool arguments but file paths, no file contents, prompts, model answers or credentials, writes nothing to disk and makes no network request; its only host commands are read-only (`git` and the process list).
- It adds no runtime dependency and uses only the mod interface Claude Code ships.
- It draws on the terminal and the desktop app from the same code, and fits the width it is given.
- Its code is strictly typed TypeScript with no `any`.

## MVP scope

In scope: the footer band, the pane and its eight sections, the command, context alerts, and the state of the current session.

Out of scope for 0.1.0: history kept across sessions, per-file diffs, permission rules (see the [roadmap](ROADMAP.md)).

## Acceptance criteria

- `claude plugin validate .` passes.
- `claude plugin test .` passes, covering the domain functions, the collectors, the state repository, hot reload and the drawing on the terminal and desktop surfaces.
- `tsc -p .` reports no error.
- In a live session, the band shows the context usage reported by Claude Code, and each pane section matches what the session did.
