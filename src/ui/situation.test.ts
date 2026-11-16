import { describe, expect, it } from "vitest"
import type { Combo, ComboType } from "../engine/combos"
import type { PlayRecord } from "../engine/game"
import { bombNote } from "./situation"

const combo = (type: ComboType, rank: number, size: number): Combo => ({ type, rank, size, cards: [] })
const played = (player: number, made: Combo | null): PlayRecord => ({ player, combo: made })

describe("the line under a bomb's banner", () => {
  const fourNines = { player: 0, combo: combo("bomb", 9, 4) }
  const bomb = played(0, fourNines.combo)

  it("says a bomb that opens a hand was led", () => {
    expect(bombNote(fourNines, [bomb], 2)).toBe("你领出4张9炸弹")
  })

  it("names the play it beat: the last one before it, skipping passes", () => {
    const log = [played(1, combo("pair", 5, 2)), played(2, combo("pair", 13, 2)), played(3, null), bomb]
    expect(bombNote(fourNines, log, 2)).toBe("你出4张9炸弹，压过对家的对K")
  })

  it("keeps saying so while the others pass on the bomb", () => {
    const log = [played(3, combo("pair", 13, 2)), bomb, played(1, null), played(2, null), played(3, null)]
    expect(bombNote(fourNines, log, 2)).toBe("你出4张9炸弹，压过上家的对K")
  })

  it("says a bomb was led when it opens a new trick after the player's own play held", () => {
    const log = [played(0, combo("pair", 13, 2)), played(1, null), played(2, null), played(3, null), bomb]
    expect(bombNote(fourNines, log, 2)).toBe("你领出4张9炸弹")
  })

  it("says a bomb was led when the player takes over the lead from a partner who went out", () => {
    // 对家 went out on a pair, everyone passed, and the lead came to the player.
    const log = [played(2, combo("pair", 13, 2)), played(3, null), played(0, null), played(1, null), bomb]
    expect(bombNote(fourNines, log, 2)).toBe("你领出4张9炸弹")
  })

  it("works for another seat's bomb over the player's cards", () => {
    const sixes = { player: 3, combo: combo("bomb", 6, 5) }
    const log = [played(0, combo("single", 14, 1)), played(1, null), played(2, null), played(3, sixes.combo)]
    expect(bombNote(sixes, log, 2)).toMatch(/^上家出5张6炸弹，压过你的/)
  })
})
