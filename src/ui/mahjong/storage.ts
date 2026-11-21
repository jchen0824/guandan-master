import { MATCH_LENGTHS, parseSave } from "../../mahjong/game"
import type { MatchLength, MatchSave } from "../../mahjong/game"

const MATCH_KEY = "guandan.mahjong.match"
const LENGTH_KEY = "guandan.mahjong.length"

/** The match the next visit carries on: null when nothing is saved, it is not a save, or that match has ended. */
export function savedMatch(): MatchSave | null {
  try {
    const save = parseSave(localStorage.getItem(MATCH_KEY))
    return save && !save.over ? save : null
  } catch {
    return null
  }
}

/** The length of the last match the player started, for a visit with nothing to carry on. 东风战 until they pick. */
export function savedLength(): MatchLength {
  try {
    const saved = localStorage.getItem(LENGTH_KEY)
    return MATCH_LENGTHS.find((length) => String(length) === saved) ?? 1
  } catch {
    return 1
  }
}

/** Keeps the match between visits. Storage is optional: the game goes on without it. */
export function writeMatch(save: MatchSave): void {
  try {
    localStorage.setItem(MATCH_KEY, JSON.stringify(save))
  } catch {
    return
  }
}

/** Forgets the saved match and remembers the length of the one being started. */
export function startOver(length: MatchLength): void {
  try {
    localStorage.removeItem(MATCH_KEY)
    localStorage.setItem(LENGTH_KEY, String(length))
  } catch {
    return
  }
}
