import { describe, expect, it } from "vitest"
import type { Combo, ComboType } from "../engine/combos"
import type { PlayRecord } from "../engine/game"
import { bombNote } from "./situation"

const combo = (type: ComboType, rank: number, size: number): Combo => ({ type, rank, size, cards: [] })
const played = (player: number, made: Combo | null): PlayRecord => ({ player, combo: made })

describe("the line under a bomb's banner", () => {
  const fourNines = { player: 0, combo: combo("bomb", 9, 4) }

  it("says a bomb that opens a trick was led", () => {
    expect(bombNote(fourNines, [played(0, fourNines.combo), null, null, null], 2)).toBe("你领出4张9炸弹")
  })

  it("names the play it beat: the nearest one before it in turn order, skipping passes", () => {
    // 下家 played a pair, 对家 played a higher pair, 上家 passed, then the bomb.
    const table = [played(0, fourNines.combo), played(1, combo("pair", 5, 2)), played(2, combo("pair", 13, 2)), played(3, null)]
    expect(bombNote(fourNines, table, 2)).toBe("你出4张9炸弹，压过对家的对K")
  })

  it("works for another seat's bomb over the player's cards", () => {
    const sixes = { player: 3, combo: combo("bomb", 6, 5) }
    const table = [played(0, combo("single", 14, 1)), played(1, null), played(2, null), played(3, sixes.combo)]
    expect(bombNote(sixes, table, 2)).toMatch(/^上家出5张6炸弹，压过你的/)
  })
})
