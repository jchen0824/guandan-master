import { describe, expect, it } from "vitest"
import { advise } from "./coach"
import { act } from "./game"
import type { MahjongState } from "./game"
import { kinds, matchWithDealer, rig } from "./testing"

const JUNK = "147m258p369s1234z"

/** The same table with a seat in 立直 whose 牌河 holds one tile of this kind. */
function withRiichi(state: MahjongState, seat: number, name: string): MahjongState {
  const kind = kinds(name)[0]
  // The coach reads only the kind of a discard, so any tile of that kind will do for the 牌河.
  const river = [{ tile: { id: kind * 4 + 3, kind }, riichi: true, tsumogiri: false, called: false }]
  const players = state.players.map((player, i) => (i === seat ? Object.assign({}, player, { riichi: 1 as const, river }) : player))
  return { ...state, players }
}

describe("教练", () => {
  it("picks the discard that leaves the most 进张, and says how far the hand is", () => {
    const advice = advise(rig(matchWithDealer(0), { hands: { 0: "23467m345p56s88s3z1s" } }))
    expect(advice).toMatchObject({ kind: "discard", pick: kinds("3z")[0], stance: "attack", riichi: false })
    expect(advice?.reason).toMatch(/^打西，打完一向听，进张 4 种 \d+ 张。$/)
  })

  it("advises 立直 when the hand is closed and 听牌 with tiles left to win on", () => {
    const advice = advise(rig(matchWithDealer(0), { hands: { 0: "234567m345p67s88s1z" } }))
    expect(advice).toMatchObject({ kind: "discard", pick: kinds("1z")[0], riichi: true })
    expect(advice?.reason).toContain("立直多一番")
  })

  it("gives up a far hand for a 现物 when someone has declared 立直, and marks how safe each tile is", () => {
    const state = withRiichi(rig(matchWithDealer(0), { hands: { 0: `${JUNK}5z` } }), 2, "7m")
    const advice = advise(state)
    expect(advice).toMatchObject({ kind: "discard", pick: kinds("7m")[0], stance: "defend" })
    expect(advice?.reason).toMatch(/^对家立直了。.*先守：打七万。.*现物/)
    const safety = advice?.kind === "discard" ? Object.fromEntries(advice.options.map((option) => [option.kind, option.safety])) : {}
    // 七万 is in 对家's 牌河. 一万 and 四万 sit three away from it: 四万 is a 筋 only if 一万 is safe too, so it is not.
    expect([safety[kinds("7m")[0]], safety[kinds("4m")[0]], safety[kinds("5p")[0]]]).toEqual(["safe", "danger", "danger"])
  })

  it("keeps attacking against a 立直 when its own hand is 听牌", () => {
    const state = withRiichi(rig(matchWithDealer(0), { hands: { 0: "234567m345p67s88s1z" } }), 2, "9p")
    expect(advise(state)).toMatchObject({ stance: "attack", pick: kinds("1z")[0] })
    expect(advise(state)?.reason).toMatch(/^对家立直了，但你的牌够近，可以攻。/)
  })

  it("takes a win, calls 役牌, and lets other discards go with the reason", () => {
    const ron = rig(matchWithDealer(0), { hands: { 0: `${JUNK}5s`, 1: "234567m345p67s88s" }, indicator: "1z" })
    const tile = ron.players[0].hand.find((held) => held.kind === kinds("5s")[0])
    const offered = act(ron, 0, { type: "discard", tile: tile ? tile.id : -1 })
    expect(advise(offered, 1)).toMatchObject({ kind: "answer", pick: { type: "ron" } })
    const chi = rig(matchWithDealer(0), { hands: { 0: `${JUNK}5s`, 1: "147m258p67s12345z" } })
    const five = chi.players[0].hand.find((held) => held.kind === kinds("5s")[0])
    const pass = advise(act(chi, 0, { type: "discard", tile: five ? five.id : -1 }), 1)
    expect(pass).toMatchObject({ kind: "answer", pick: { type: "pass" } })
    expect(pass?.reason).toContain("鸣了就不能立直")
    // The pass is a rule for beginners. The reason must not claim the hand has no 役, which the coach does not check.
    expect(pass?.reason).not.toMatch(/没有别的役|和不了/)
    expect(pass?.reason).toContain("教练只建议碰役牌")
  })

  it("has nothing to say when it is not the seat's turn", () => {
    expect(advise(rig(matchWithDealer(1), {}), 0)).toBeNull()
  })
})
