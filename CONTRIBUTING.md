# Contributing

Thank you for helping improve Session Inspector.

## Before you start

- Open an issue to discuss a new feature before writing it, so the work fits the [roadmap](docs/ROADMAP.md).
- Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) to see where a change belongs.

## Rules for changes

- Use only the mod interface Claude Code actually ships: the types Claude Code writes into `.claude-plugin/types/` are the reference. Never invent an event, a method or an element.
- The mod only observes: every hook passes its event on unchanged and is registered with a `.catch` that passes it on too.
- Never keep tool arguments, file contents, prompts, model answers or credentials.
- Only `src/state/repository.ts` reads or writes `$.state`, because Claude Code's validator reads state values only where they are used.
- When a stored value changes shape, change its `shape` tag in the repository so values an older version stored are read as empty.
- Keep functions small and pure in `src/domain/`, and add a test for every behaviour you add or fix.
- Add no runtime dependency.

## Checks

Run the full check before opening a pull request:

```
npm install
npm run check
```

It type-checks the code, validates the plugin and the marketplace, and runs every test. The type check needs the types Claude Code writes when it loads the mod: see [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Pull requests

- Keep each pull request to one change, with a clear title and a short description of what changed and why.
- Add a line to `CHANGELOG.md` under a new "Unreleased" heading.
