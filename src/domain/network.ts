// Megabits per second for bytes moved in ms; undefined when no time passed.
export function megabitsPerSecond(bytes: number, ms: number): number | undefined {
  return ms > 0 ? Math.round((bytes * 8) / (ms * 1000)) : undefined
}
