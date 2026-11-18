# Development

## Requirements

- Claude Code 2.1.327 or newer, signed in.
- Node.js 22 or newer, for the TypeScript compiler.

## Setup

```
npm install
```

This installs TypeScript, the only development dependency.

## Running the mod from your copy

```
claude --plugin-dir .
```

In an interactive session Claude Code watches the folder: saving a file reloads the mod, and the session state is kept across the reload.

## Checks

| Command | What it does |
| --- | --- |
| `npm run typecheck` | Type-checks the mod with `tsc -p .`. |
| `npm run validate` | Runs `claude plugin validate .` on the plugin and its marketplace. |
| `npm test` | Runs every `*.test.ts` and `*.test.tsx` in `tests` with `claude plugin test`. |
| `npm run check` | Runs the three above in order. |

The type check needs the declarations Claude Code writes into `.claude-plugin/types/` each time it loads the mod, so start one session with `--plugin-dir .` before the first type check. That folder is ignored by git.

## Tests

The tests import their kit from `claude-code/testing`, which runs them in an environment like the one the mod runs in, against Claude Code itself.

- `reducers.test.ts` and `domain.test.ts` test the pure domain functions alone.
- The other files load the whole mod: `engine-stubs.ts` stands for the engine beneath it (session id, model, usage, clock, commands, panes), the test raises real events (`$.session.start`, `$.turn.start`, `$.tool.call`, `$.session.measure`, `$.agent.spawn`, `$.session.end`) and then draws the band or the pane on the terminal and desktop surfaces and reads what is drawn.

## Where things go

- A new event to watch: a collector in `src/collectors/`, calling pure functions from `src/domain/` and the repository.
- A new stored value: declare it in `types/index.d.ts`, add its atom and functions to `src/state/repository.ts`.
- A new section or band piece: `src/ui/`.

## Debugging

Run Claude Code with `--debug` to see every hook that failed and every drawing Claude Code refused, with the reason.
