import { describe, expect, it } from "vitest"
import { advise, gradeChoice } from "./coach"
import { HERO, SEATS, act, legalActions, newTable } from "./game"
import type { Action, HoldemState } from "./game"
import { bettorsAgainst, draws, equity, potOdds } from "./odds"
import { cards, rig, seeded, stacked } from "./testing"

const VILLAIN = 1

/** A flop where seat 1 raised before it and has now bet `bet`, with the hero left to answer. Everyone else folded. */
function facingBet(hole: string, board: string, bet: number, villainStack?: number): HoldemState {
  const table = newTable(seeded(3))
  let state = rig(villainStack === undefined ? table : stacked(table, { [VILLAIN]: villainStack }), { [HERO]: hole, [VILLAIN]: "KD KC" }, board)
  while (state.street === "preflop") {
    const seat = state.toAct as number
    const easy: Action = legalActions(state).canCheck ? { kind: "check" } : { kind: "call" }
    if (seat === VILLAIN) state = act(state, seat, state.currentBet === 20 ? { kind: "raise", to: 60 } : easy)
    else if (seat === HERO) state = act(state, seat, easy)
    else state = act(state, seat, legalActions(state).canCheck ? { kind: "check" } : { kind: "fold" })
  }
  while (!(state.toAct === HERO && state.currentBet > 0)) {
    const seat = state.toAct as number
    state = act(state, seat, seat === VILLAIN ? { kind: "raise", to: bet } : { kind: "check" })
  }
  return state
}

describe("win rates and draws", () => {
  it("puts two aces near 85% against one random hand, and seven-two far behind five", () => {
    const aces = equity(cards("AS AH"), [], 1, seeded(1), 2000)
    expect(aces).toBeGreaterThan(0.8)
    expect(aces).toBeLessThan(0.9)
    expect(equity(cards("7C 2D"), [], 5, seeded(1), 1000)).toBeLessThan(0.15)
  })

  it("is less hopeful against an opponent who has bet", () => {
    const hole = cards("AH JH")
    const board = cards("KS 9H 4H")
    const anyHand = equity(hole, board, 1, seeded(2), 1500)
    const afterBet = equity(hole, board, 1, seeded(2), 1500, 1)
    expect(afterBet).toBeLessThan(anyHand - 0.05)
    expect(afterBet).toBeGreaterThan(0.35)
  })

  it("counts the cards that complete a flush or a straight", () => {
    expect(draws(cards("AH JH"), cards("KS 9H 4H"))).toMatchObject({ outs: 9, flushDraw: true, straightDraw: null, text: "听同花，还有 9 张牌能帮你" })
    expect(draws(cards("9S 8D"), cards("7H 6C 2D"))).toMatchObject({ outs: 8, straightDraw: "open", text: "两头听顺子，还有 8 张牌能帮你" })
    expect(draws(cards("9S 8D"), cards("6H 5C 2D"))).toMatchObject({ outs: 4, straightDraw: "gutshot" })
    expect(draws(cards("AH JH"), cards("KH 9H 4H")).text).toBeNull()
    expect(draws(cards("AH JH"), []).text).toBeNull()
  })

  it("prices a call as its share of the pot after calling", () => {
    const state = facingBet("AH JH", "KS 9H 4H", 100)
    const { call, potAfterCall, need } = potOdds(state)
    expect(call).toBe(100)
    expect(potAfterCall).toBe(state.pot + 100)
    expect(need).toBeCloseTo(100 / (state.pot + 100))
  })

  it("prices an all-in call against only the chips the caller can win", () => {
    const dealt = newTable(seeded(3))
    const bigBlind = (dealt.button + 2) % SEATS
    let state = act(stacked(dealt, { [bigBlind]: 100 }), dealt.toAct as number, { kind: "raise", to: 1000 })
    while (state.toAct !== bigBlind) state = act(state, state.toAct as number, { kind: "fold" })
    // 80 more to call. The caller can win their own 100, 100 of the raise and the small blind's 10.
    expect(state.pot).toBe(1030)
    expect(potOdds(state, bigBlind)).toEqual({ call: 80, potAfterCall: 210, need: 80 / 210 })
  })

  it("counts the players who have bet on this street, for the win rate against them", () => {
    const state = facingBet("AH JH", "KS 9H 4H", 100)
    expect(bettorsAgainst(state)).toBe(1)
    expect(bettorsAgainst(state, 1)).toBe(0)
  })
})

describe("the coach", () => {
  it("tells a beginner to fold nothing against a big bet, with the numbers", () => {
    const state = facingBet("7C 2D", "AS KH 9D", 150)
    const advice = advise(state, seeded(5))
    expect(advice.action).toEqual({ kind: "fold" })
    expect(advice.title).toBe("建议：弃牌")
    expect(advice.need).toBeGreaterThan(advice.have)
    expect(advice.reason).toMatch(/要有 \d+% 的胜率/)
    expect(advice.situation).toMatch(/^甲下注 150，底池现在 /)
    expect(advice.made).toBe("highCard")
  })

  it("lets a draw call a little below the price only when it can win more later", () => {
    // An open-ended straight draw facing a bet of 300: about 36% to win, and the call needs 40%.
    const deep = advise(facingBet("7D 6C", "9S 8H 2C", 300), seeded(5))
    expect(deep.need).toBeGreaterThan(deep.have)
    expect(deep.action).toEqual({ kind: "call" })
    expect(deep.reason).toMatch(/再赢一笔/)

    // The same bet is seat 1's last chips, so the straight would win nothing more.
    const state = facingBet("7D 6C", "9S 8H 2C", 300, 360)
    expect(state.seats[VILLAIN].allIn).toBe(true)
    const shove = advise(state, seeded(5))
    expect(shove.action).toEqual({ kind: "fold" })
    expect(shove.reason).not.toMatch(/再赢一笔/)
  })

  it("keeps a strong flush draw in the hand when the price is good", () => {
    const state = facingBet("AH JH", "KS 9H 4H", 40)
    const advice = advise(state, seeded(5))
    expect(advice.action.kind).not.toBe("fold")
    expect(advice.have).toBeGreaterThan(advice.need as number)
    expect(advice.drawText).toBe("听同花，还有 9 张牌能帮你")
  })

  it("raises the best starting hands and folds the worst ones from an early seat", () => {
    const dealt = newTable(seeded(3))
    const early = { ...dealt, button: (HERO + 3) % 6, toAct: HERO, pending: [HERO, ...dealt.pending.filter((seat) => seat !== HERO)] }
    const aces = advise(rig(early, { [HERO]: "AS AH" }, "2C 7D 9H 3S 4D"), seeded(5))
    expect(aces.title).toMatch(/^建议：加注到 \d+/)
    expect(aces.reason).toContain("顶尖的起手牌")
    const junk = advise(rig(early, { [HERO]: "7C 2D" }, "2C 7D 9H 3S 4D"), seeded(5))
    expect(junk.action).toEqual({ kind: "fold" })
    expect(junk.reason).toContain("枪口")
    expect(junk.reminder).toMatch(/在你后面还没行动/)
  })

  it("grades a choice against its own advice", () => {
    const fold = advise(facingBet("7C 2D", "AS KH 9D", 150), seeded(5))
    expect(gradeChoice(fold, { kind: "fold" })).toMatchObject({ verdict: "good", label: "好" })
    expect(gradeChoice(fold, { kind: "call" })).toMatchObject({ verdict: "poor", label: "欠妥" })
    const stay = advise(facingBet("AH JH", "KS 9H 4H", 40), seeded(5))
    expect(gradeChoice(stay, { kind: "fold" }).verdict).not.toBe("good")
  })
})
