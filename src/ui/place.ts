import type { CSSProperties } from "react"

/**
 * Turns numbers into CSS custom properties (`{ i: 2 }` becomes `--i: 2`).
 * The 3D table places each card from its index and its group's size; `src/index.css` does the maths.
 */
export function place(values: Record<string, number>): CSSProperties {
  return Object.fromEntries(Object.entries(values).map(([name, value]) => [`--${name}`, value]))
}
