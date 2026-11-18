import { TABLE_SIZES, parseTableSave, stacksOver } from "../../holdem/game"
import type { TableSave, TableSize } from "../../holdem/game"

const TABLE_KEY = "guandan.holdem.table"
const SIZE_KEY = "guandan.holdem.seats"

/** The table the next visit carries on: null when nothing is saved, it is not a save, or that table has ended. */
export function savedTable(): TableSave | null {
  try {
    const save = parseTableSave(localStorage.getItem(TABLE_KEY))
    return save && !stacksOver(save.stacks) ? save : null
  } catch {
    return null
  }
}

/** The size of the last table the player started, for a visit with nothing to carry on. 6 until they pick. */
export function savedSize(): TableSize {
  try {
    const saved = localStorage.getItem(SIZE_KEY)
    return TABLE_SIZES.find((size) => String(size) === saved) ?? 6
  } catch {
    return 6
  }
}

/** Keeps the table between hands. Storage is optional: the game goes on without it. */
export function writeTable(save: TableSave): void {
  try {
    localStorage.setItem(TABLE_KEY, JSON.stringify(save))
  } catch {
    return
  }
}

/** Remembers the size of the table the player picked, for the next visit with nothing to carry on. */
export function writeSize(size: TableSize): void {
  try {
    localStorage.setItem(SIZE_KEY, String(size))
  } catch {
    return
  }
}

/** Forgets the saved table and remembers the size of the one being started. */
export function startOver(size: TableSize): void {
  try {
    localStorage.removeItem(TABLE_KEY)
  } catch {
    return
  }
  writeSize(size)
}
