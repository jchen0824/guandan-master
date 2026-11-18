import { describe, expect, it } from "vitest"
import { botAction } from "./bot"
import { advise, gradeChoice } from "./coach"
import { HERO, act, legalActions, newTable, resumeTable } from "./game"
import type { Action, HoldemState } from "./game"
import { bettorsAgainst, draws, equity, potOdds, shareOfPot } from "./odds"
import { cards, rig, seeded, stacked } from "./testing"

const VILLAIN = 1
const last = <T>(list: T[]) => list[list.length - 1]

/** A flop (or a later street, after checks) where seat 1 raised before it and has now bet `bet`, with the hero left
 * to answer. Everyone else folded. */
function facingBet(hole: string, board: string, bet: number, villainStack?: number, street: HoldemState["street"] = "flop"): HoldemState {
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
    state = act(state, seat, seat === VILLAIN && state.street === street ? { kind: "raise", to: bet } : { kind: "check" })
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
    const bigBlind = (dealt.button + 2) % dealt.seats.length
    let state = act(stacked(dealt, { [bigBlind]: 100 }), dealt.toAct as number, { kind: "raise", to: 1000 })
    while (state.toAct !== bigBlind) state = act(state, state.toAct as number, { kind: "fold" })
    // 80 more to call. The caller can win their own 100, 100 of the raise and the small blind's 10.
    expect(state.pot).toBe(1030)
    expect(potOdds(state, bigBlind)).toEqual({ call: 80, potAfterCall: 210, need: 80 / 210 })
  })

  it("gives the same win rate pot by pot as overall when there is only one pot", () => {
    const state = facingBet("AH JH", "KS 9H 4H", 100)
    expect(shareOfPot(state, HERO, seeded(9), 300)).toBeCloseTo(equity(cards("AH JH"), cards("KS 9H 4H"), 1, seeded(9), 300, 1), 10)
  })

  it("does not count a short stack's all-in as competing for the side pot", () => {
    // Three players put in 40 each and the short one is all-in. The board is a royal flush, so all three tie.
    const short = 2
    let state = rig(stacked(newTable(seeded(3)), { [short]: 40 }), { [HERO]: "2C 3D", [VILLAIN]: "4C 5D", [short]: "6C 7D" }, "AS KS QS JS TS")
    const playing = new Set([HERO, VILLAIN, short])
    while (state.street === "preflop") {
      const seat = state.toAct as number
      const legal = legalActions(state)
      if (!playing.has(seat)) state = act(state, seat, legal.canCheck ? { kind: "check" } : { kind: "fold" })
      else if (state.currentBet < 40 && legal.minRaiseTo !== null) state = act(state, seat, { kind: "raise", to: 40 })
      else state = act(state, seat, legal.canCheck ? { kind: "check" } : { kind: "call" })
    }
    while (!(state.toAct === HERO && state.currentBet > 0)) {
      const seat = state.toAct as number
      state = act(state, seat, seat === VILLAIN && state.street === "river" ? { kind: "raise", to: 1000 } : { kind: "check" })
    }
    expect(state.seats[short].allIn).toBe(true)
    const { call, potAfterCall, need } = potOdds(state)
    expect(call).toBe(1000)
    // Calling gets back a third of the main pot and half of the side pot, more than the 1,000 it costs.
    const main = state.seats.reduce((sum, seat) => sum + Math.min(seat.total, 40), 0)
    const back = main / 3 + 1000
    expect(shareOfPot(state, HERO, seeded(5), 50)).toBeCloseTo(back / potAfterCall, 10)
    expect(back / potAfterCall).toBeGreaterThan(need)
    // One win rate over the whole pot says a third, which is below the price: that is the mistake this avoids.
    expect(equity(cards("2C 3D"), state.board, 2, seeded(5), 50)).toBeCloseTo(1 / 3, 10)
    expect(1 / 3).toBeLessThan(need)
    const advice = advise(state, seeded(5))
    expect(advice.action).toEqual({ kind: "call" })
    expect(advice.reason).not.toMatch(/不够/)
  })

  it("has a novice call a bet that is slightly too big, where an advanced player folds", () => {
    // An open-ended straight draw facing 300: about 36% to win, and the call needs 40%.
    const state = facingBet("7D 6C", "9S 8H 2C", 300)
    expect(botAction(state, HERO, seeded(5), "novice")).toEqual({ kind: "call" })
    expect(botAction(state, HERO, seeded(5), "advanced")).toEqual({ kind: "fold" })
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

  it("shows its working after the flop: the hand, the outs, the opponents and the 2-and-4 rule", () => {
    const advice = advise(facingBet("AH JH", "KS 9H 4H", 40), seeded(5))
    expect(advice.explain.map((line) => line.key)).toEqual(["hand", "outs", "opponents", "estimate", "rule"])
    expect(advice.explain.map((line) => line.text)).toEqual([
      "只有 A 高，还没成牌",
      "来一张红桃就成同花（还剩 9 张）；来一张 A 就成顶对（还剩 3 张）",
      "甲下注了，下注的人通常至少有一对；你现在多半落后",
      `还有转牌和河牌两张，二四法则：12 张有效牌 × 4 ≈ 48%（电脑模拟约 ${Math.round(advice.have * 100)}%）`,
      `有效牌就是“能帮你的牌”。你看不到的牌有 47 张，每发一张，某一张牌出现的机会约 2%。还要发转牌和河牌两张，每张有效牌约 2% + 2% = 4%，所以 12 × 4 ≈ 48%。`,
    ])
  })

  it("explains the 2-and-4 rule as times 2 when only the river is to come", () => {
    const advice = advise(facingBet("8D 7D", "AS KD 2D QC", 40, undefined, "turn"), seeded(5))
    expect(advice.explain.find((line) => line.key === "rule")?.text).toBe(
      `有效牌就是“能帮你的牌”。你看不到的牌有 46 张，每发一张，某一张牌出现的机会约 2%。只剩河牌一张，每张有效牌约 2%，所以 9 × 2 ≈ 18%。`,
    )
  })

  it("says why the simulation and the 2-and-4 rule differ, when they are far apart", () => {
    // Only a 4 makes a hand, but a bettor often has less than the pair on the board can beat.
    const higher = advise(facingBet("5D 3S", "6H 6C 2C", 40), seeded(5))
    expect(higher.explain.find((line) => line.key === "estimate")?.text).toMatch(/4 张有效牌 × 4 ≈ 16%/)
    expect(higher.have).toBeGreaterThan(0.24)
    expect(last(higher.explain).text).toMatch(/^电脑模拟更高/)

    // 21 outs times 4 is 84%, far more than the turn and river can deliver.
    const lower = advise(facingBet("QH JH", "TH 9S 2H", 40), seeded(5))
    expect(lower.have).toBeLessThan(0.76)
    expect(last(lower.explain).text).toMatch(/^电脑模拟更低：有效牌多于 8 张时，乘 4 会算多/)
  })

  it("on the river, counts no outs and says what the hand beats at the showdown", () => {
    const state = facingBet("9H 9D", "AS 8C 3D 2S 4H", 40, undefined, "river")
    expect(state.street).toBe("river")
    const advice = advise(state, seeded(5))
    expect(advice.explain.map((line) => line.key)).toEqual(["hand", "opponents", "estimate"])
    expect(last(advice.explain).text).toMatch(/^牌已经发完，比的是现在谁大：你的对子能赢更小的对子，也能赢诈唬（电脑模拟约 \d+%）$/)
  })

  it("does not call a made hand ahead when the simulation says it is behind", () => {
    // Top pair with a kicker that does not play, against a river bet: below even.
    const behind = advise(facingBet("KS 2D", "KH QC JS TD 3C", 300, undefined, "river"), seeded(5))
    expect(behind.have).toBeLessThan(0.5)
    expect(behind.have).toBeGreaterThanOrEqual(0.35)
    expect(last(behind.explain).text).toMatch(/^你的牌未必领先：对手有一张 A 或 9 就是顺子（电脑模拟约 \d+%）$/)
    // Top pair on four spades and four to a straight: far behind, and the board says why.
    const far = advise(facingBet("AH 2D", "AS KS QS JS 3D", 300, undefined, "river"), seeded(5))
    expect(far.have).toBeLessThan(0.35)
    expect(last(far.explain).text).toMatch(/^你的牌多半已经落后：对手有一张黑桃就是同花，有一张 10 就是顺子（电脑模拟约 \d+%）$/)
    expect(far.explain.find((line) => line.key === "opponents")?.text).toBe("甲下注了，下注的人通常至少有一对；顶对常常领先，但会输给两对、三条、同花、顺子")
    // A set on a dry flop is well ahead.
    const ahead = advise(facingBet("9C 9D", "9S 5H 2C", 40), seeded(5))
    expect(ahead.have).toBeGreaterThanOrEqual(0.5)
    expect(last(ahead.explain).text).toMatch(/^你多半已经领先/)
  })

  it("does not call a hand all on the board behind a bettor, who has it too", () => {
    const advice = advise(facingBet("AS 4D", "AH KC QS JD TC", 300, undefined, "river"), seeded(5))
    expect(advice.explain.find((line) => line.key === "opponents")?.text).toBe("甲下注了，下注的人通常至少有一对；这手牌你和他都有，他的牌要比公共牌大才能赢你")
  })

  it("on a river where the board plays, says the player can at best split", () => {
    const advice = advise(facingBet("3H 2D", "AS QD JH 9S 7C", 40, undefined, "river"), seeded(5))
    expect(advice.explain[0].text).toMatch(/：这手牌全在公共牌上，大家都有$/)
    expect(last(advice.explain).text).toMatch(/^牌已经发完，比的是现在谁大：这手牌大家都有，最多和别人平分/)
  })

  it("keeps the working for after the flop, and says a strong hand need not count outs", () => {
    const table = newTable(seeded(3))
    expect(advise({ ...table, toAct: HERO }, seeded(5)).explain).toEqual([])
    const set = advise(facingBet("9C 9D", "9S 5H 2C", 40), seeded(5))
    expect(set.explain[0].text).toBe("暗三条 9：口袋对子中了第三张，很强")
    expect(last(set.explain).text).toMatch(/^你多半已经领先，不用数有效牌/)
  })

  it("tells the heads-up button it acts first before the flop, not that it can watch the other player first", () => {
    const save = { version: 1 as const, savedAt: "", handNumber: 1, button: 5, stacks: [2000, 2000, 0, 0, 0, 0] }
    const state = rig(resumeTable(save, seeded(1)), { [HERO]: "7C 2D", [VILLAIN]: "KD KC" }, "AS 8C 3D 2S 4H")
    expect([state.button, state.toAct]).toEqual([HERO, HERO])
    const advice = advise(state, seeded(5))
    expect(advice.reason).toContain("你在庄位，两个人时庄位也是小盲：翻牌前你先行动，翻牌后你最后行动")
    expect(advice.reason).not.toContain("能先看别人怎么做")
  })

  it("raises the best starting hands and folds the worst ones from an early seat", () => {
    const dealt = newTable(seeded(3))
    const early = { ...dealt, button: (HERO + 3) % dealt.seats.length, toAct: HERO, pending: [HERO, ...dealt.pending.filter((seat) => seat !== HERO)] }
    const aces = advise(rig(early, { [HERO]: "AS AH" }, "2C 7D 9H 3S 4D"), seeded(5))
    expect(aces.title).toMatch(/^建议：加注到 \d+/)
    expect(aces.reason).toContain("顶尖的起手牌")
    const junk = advise(rig(early, { [HERO]: "7C 2D" }, "2C 7D 9H 3S 4D"), seeded(5))
    expect(junk.action).toEqual({ kind: "fold" })
    expect(junk.reason).toContain("枪口")
    expect(junk.reminder).toMatch(/在你后面还没行动/)
  })

  it("folds a playable hand from 枪口+1 at a nine-seat table, and says which seat that is", () => {
    const dealt = newTable(seeded(3), 9)
    const early = { ...dealt, button: (HERO + 9 - 4) % 9, toAct: HERO, pending: [HERO, ...dealt.pending.filter((seat) => seat !== HERO)] }
    const advice = advise(rig(early, { [HERO]: "AS TD" }, "2C 7D 9H 3S 4D"), seeded(5))
    expect(advice.action).toEqual({ kind: "fold" })
    expect(advice.reason).toContain("你在枪口+1，后面还有好几个人没行动")
    const late = advise(rig({ ...early, button: HERO }, { [HERO]: "AS TD" }, "2C 7D 9H 3S 4D"), seeded(5))
    expect(late.action).toMatchObject({ kind: "raise" })
  })

  it("grades a choice against its own advice", () => {
    const fold = advise(facingBet("7C 2D", "AS KH 9D", 150), seeded(5))
    expect(gradeChoice(fold, { kind: "fold" })).toMatchObject({ verdict: "good", label: "好" })
    expect(gradeChoice(fold, { kind: "call" })).toMatchObject({ verdict: "poor", label: "欠妥" })
    const stay = advise(facingBet("AH JH", "KS 9H 4H", 40), seeded(5))
    expect(gradeChoice(stay, { kind: "fold" }).verdict).not.toBe("good")
  })
})
