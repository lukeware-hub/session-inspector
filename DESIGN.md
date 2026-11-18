# Design

Session Inspector is an Operate surface drawn in a terminal: the person is in a task and glances down. The design is restrained instrument-panel chrome: one framed band, a fixed label column, values in plain text, and color reserved for meaning.

## Medium

- Terminal cells, Claude Code's elements only (`Box`, `Text`, `Button`, `Progress`). No fonts, no images: type is the terminal's own monospace.
- Colors are Claude Code theme keys, so the mod follows the person's dark or light theme.

## Color roles

| Role | Theme key | Used for |
| --- | --- | --- |
| Brand mark | `claude` | The title "Session Inspector" and the active section only. |
| Good | `success` | Running status, Normal context level, healthy figures. |
| Watch | `warning` | Attention and High context, limits at 70% or more. |
| Danger | `error` | Critical context, failed and denied tool calls, limits at 95% or more. |
| Secondary | dim text | Labels, units, separators, idle status, empty states. |
| Body | default text | Every value. |

## Shapes

- **The band** is one rounded frame (`borderStyle: round`, dim border). Its first row holds the title on the left and the session status on the right; then one row per line of figures, each led by a label in a fixed 9-column label column (`Context`, `Session`, `System`).
- When the band has fewer than five rows of room, the frame is dropped and the rows stay.
- **Meters** are ten cells of `▰` (filled) and `▱` (empty), colored by level. They are the only graphic in the band.
- **Status glyphs**: `●` running, `○` idle, `■` ended. No other glyph stands in for an icon.
- Figures are separated by three spaces, never by bars or middle dots.

## Pane

- A row of plain section buttons with hotkeys `1` to `8`; the active one is bold in the brand color, the others dim.
- Each section is a column of `label  value` rows with the same label column, and tables whose columns line up in fixed widths.
- Empty sections say what will fill them and when.

## Copy

- Sentence case, the product's own words: "Context", "Tokens in context", "Session total", "Cost (estimate)".
- Missing values are `—`.
