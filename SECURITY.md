# Security

## What the mod does with your session

Session Inspector only observes the Claude Code session it runs in.

- It never changes a prompt, a model answer, a tool call, a command or a permission, never blocks a tool and never approves a permission. Every hook passes its event on unchanged, and a failure inside the mod is caught so the session goes on as if the mod were not there.
- It keeps only tool names, agent ids and types, the first 60 characters of a subagent's short task description, counts, times, token figures, Claude Code's cost estimate and rate-limit figures, the paths of the files tools read or edited, an estimate of each tool result's size, and for the last 20 calls a short fingerprint of their arguments (a hash, used only to notice the same call repeating).
- It never keeps other tool arguments, file contents, tool results, prompts, model answers or credentials. The fingerprint cannot be turned back into the arguments.
- It keeps everything in Claude Code's session state, in memory. It writes nothing to disk and nothing outlives the session.
- It makes no network request and reads no file.

## Local commands

The mod runs these read-only commands on your machine, with Claude Code's `$.process.run` (no shell is involved except the one-line `/bin/sh` wrapper on macOS and Linux):

| Command | Why | When |
| --- | --- | --- |
| `git rev-parse HEAD` | Remembers the commit the session started on. | Once per session, in a git repository. |
| `git diff --numstat <that commit>` | Counts lines added and removed since then. | After each turn and when `/inspector` opens. |
| `powershell.exe ... Get-CimInstance Win32_Process` (Windows) or `ps -A -o pid=,ppid=,rss=,time=,comm=` (macOS, Linux) | Measures CPU and memory of the Claude Code process tree. | At most once every 10 seconds, at turn start and end and when `/inspector` opens. |
| `powershell.exe ... NetworkInterface GetIPStatistics` (Windows and WSL), `cat /sys/class/net/<adapter>/statistics/rx_bytes` and `tx_bytes` (Linux), or `networksetup -listallhardwareports` and `netstat -ibn -I <adapter>` (macOS) | Reads the bytes the Wi-Fi adapter received and sent, to show its traffic in MB/s. | Every 5 seconds while the session is open. |

Only figures are kept from their output: line counts, the memory and CPU time of the Claude Code processes, and the Wi-Fi byte counters. The rest of the process list is discarded at once.

You can confirm all of this with `claude plugin validate .`, which lists every call the mod makes on Claude Code's interface.

## Supported versions

| Version | Supported |
| --- | --- |
| 0.3.x | Yes |
| 0.2.x | No |
| 0.1.x | No |

## Reporting a vulnerability

Please report a vulnerability privately through the repository's GitHub security advisories ("Report a vulnerability" on the Security tab), not in a public issue. Describe the problem and how to reproduce it. You will get an answer within seven days.
