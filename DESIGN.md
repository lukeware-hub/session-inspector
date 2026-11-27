# Design

Session Inspector is an Operate surface drawn in a terminal: the person is in a task and glances down. The design is restrained instrument-panel chrome: one framed band, a fixed label column, values in plain text, and color reserved for meaning.

## Medium

- Terminal cells, Claude Code's elements only (`Box`, `Text`, `Button`, `Progress`). No fonts, no images: type is the terminal's own monospace.
- Colors are Claude Code theme keys, so the mod follows the person's dark or light theme.

## Color roles

| Role | Theme key | Used for |
| --- | --- | --- |
| Brand mark | `claude` | The title "Session Inspector" and the active section only. |
| Good | `success` | Running status, Normal context level, CPU and rate limits below 70%. |
| Watch | `warning` | Attention and High context, limits at 70% or more. |
| Danger | `error` | Critical context, failed and denied tool calls, limits at 95% or more. |
| Secondary | dim text | Labels, units, separators, idle status, empty states. |
| Body | default text | Every value. |
| Agent marks | fixed hues | One color per row of the agent list (green, amber, blue, pink, cyan, lime, orange), so agents side by side are told apart; the only colors that are not theme keys. |

## Shapes

- **The band** is one rounded frame (`borderStyle: round`, dim border). Its first row holds the title on the left and the model, the effort and the session status on the right; then one row per line of figures, laid out as a grid whose gaps share the band's width so the widest last figure ends on the right edge, under the status, each led by a label in a fixed 9-column label column (`Context`, `Session`, `System`, and `Limits` when the account reports rate limits).
- Every figure carries its own dim label before its value (`used`, `tokens`, `level`, `time`, `subagents`, `turns`, `tools`, `cost`, `CPU`, `RAM`, `speed`, `5h`).
- When the band has fewer than five rows of room, the frame is dropped and the rows stay.
- **Meters** are one scale for every percentage: ten full-height cells of `█` (filled) and `░` (empty), colored by level. They are the only graphic in the band.
- **Status glyphs**: `●` running, `○` idle, `■` ended. No other glyph stands in for an icon.
- **The grid**: the rows share columns. Column N has one width in every row, labels in a column are padded to one width so values and meters start on the same cell, and percentages are right-aligned. Gaps are 3 cells and widen with the room up to 8; on a narrow band whole columns leave from the right in every row alike. A missing value keeps its column with a dash, and a message (waiting, a loop alert) spans its row. Never bars or middle dots between figures.

## Pane

- A row of plain section buttons with hotkeys `1` to `8`; the active one is bold in the brand color, the others dim.
- Each section is a column of `label  value` rows with the same label column, and tables whose columns line up in fixed widths.
- Empty sections say what will fill them and when.

## Copy

- Sentence case, the product's own words: "Context", "Tokens in context", "Session total", "Cost (estimate)".
- Missing values are `—`.
- **Cards** (desktop always, terminal when every row fits at three lines a row): each figure is a round dim-bordered card, its label dim on top and its value below; the cards sit in four columns (two, then one, as the room shrinks) that line up in every row, with the row names in a narrow column to the left. A figure at watch or danger level colors its border too.
