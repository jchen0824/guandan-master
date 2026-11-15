import { describe, expect, it } from "vitest"
import { advise, chooseReturn } from "./bot"
import type { Skill } from "./bot"
import { shuffle } from "./cards"
import type { Card, Suit } from "./cards"
import { beats, classify, legalPlays, readPlay } from "./combos"
import { canReturn, checkPlay, newMatch, parseSave, pass, play, resumeMatch, returnTribute, startNextHand, toSave } from "./game"
import type { GameState } from "./game"

let nextId = 1000
const RANKS: Record<string, number> = { J: 11, Q: 12, K: 13, A: 14 }

function cards(text: string): Card[] {
  return text.split(" ").map((token) => {
    if (token === "sj") return { id: nextId++, suit: "J", rank: 16 }
    if (token === "bj") return { id: nextId++, suit: "J", rank: 17 }
    const rank = RANKS[token.slice(1)] ?? Number(token.slice(1))
    return { id: nextId++, suit: token[0] as Suit, rank }
  })
}

const top = (text: string, level = 2) => classify(cards(text), level)[0]

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

describe("combinations", () => {
  it("reads the basic shapes", () => {
    expect(top("S7")).toMatchObject({ type: "single", rank: 7 })
    expect(top("S7 H7")).toMatchObject({ type: "pair", rank: 7 })
    expect(top("S7 H7 C7")).toMatchObject({ type: "triple", rank: 7 })
    expect(top("S7 H7 C7 D9 S9")).toMatchObject({ type: "fullHouse", rank: 7 })
    expect(top("S3 H4 C5 D6 S7")).toMatchObject({ type: "straight", rank: 7 })
    expect(top("S3 H3 C4 D4 S5 H5")).toMatchObject({ type: "tube", rank: 5 })
    expect(top("S3 H3 C3 D4 S4 H4")).toMatchObject({ type: "plate", rank: 4 })
    expect(top("S9 H9 C9 D9")).toMatchObject({ type: "bomb", size: 4 })
    expect(top("S3 S4 S5 S6 S7")).toMatchObject({ type: "straightFlush", rank: 7 })
    expect(top("sj sj bj bj")).toMatchObject({ type: "jokerBomb" })
  })

  it("rejects cards that form nothing", () => {
    expect(classify(cards("S3 H4"), 2)).toEqual([])
    expect(classify(cards("S3 H4 C5 D6"), 2)).toEqual([])
    expect(classify(cards("S3 H4 C5 D6 S7 H8"), 2)).toEqual([])
    expect(classify(cards("sj bj"), 2)).toEqual([])
    expect(classify(cards("S3 H3 C4 D4"), 2)).toEqual([])
  })

  it("lets the ace sit at either end of a straight but not wrap", () => {
    expect(top("SA H2 C3 D4 S5", 9)).toMatchObject({ type: "straight", rank: 5 })
    expect(top("S10 HJ CQ DK SA", 9)).toMatchObject({ type: "straight", rank: 14 })
    expect(classify(cards("SQ HK CA D2 S3"), 9)).toEqual([])
  })

  it("ranks the level card above the ace except inside straights", () => {
    expect(top("S5", 5).rank).toBe(15)
    expect(beats(top("S5 C5", 5), top("SA CA", 5))).toBe(true)
    expect(top("S3 C4 S5 D6 S7", 5)).toMatchObject({ type: "straight", rank: 7 })
  })

  it("uses the heart level card as a wild card", () => {
    expect(top("H5 S9", 5)).toMatchObject({ type: "pair", rank: 9 })
    expect(top("H5 H5 S9", 5)).toMatchObject({ type: "triple", rank: 9 })
    expect(top("H5 S9 C9 D9", 5)).toMatchObject({ type: "bomb", size: 4, rank: 9 })
    expect(top("H5 S3 C4 D6 S7", 5)).toMatchObject({ type: "straight", rank: 7 })
    expect(top("H5 S6 S7 S8 S9", 5)).toMatchObject({ type: "straightFlush", rank: 10 })
    expect(top("H5 H5", 5)).toMatchObject({ type: "pair", rank: 15 })
    expect(top("H5", 5)).toMatchObject({ type: "single", rank: 15 })
  })

  it("never lets a wild card stand in for a joker", () => {
    expect(classify(cards("H5 sj"), 5)).toEqual([])
    expect(classify(cards("H5 sj sj bj"), 5)).toEqual([])
  })

  it("takes the higher full house when a wild card could go either way", () => {
    expect(top("H5 S9 C9 DK SK", 5)).toMatchObject({ type: "fullHouse", rank: 13 })
  })

  it("reads two pairs plus two wild cards as either shape", () => {
    const types = classify(cards("S3 C3 S4 C4 H9 H9"), 9).map((c) => c.type)
    expect(types).toContain("tube")
    expect(types).toContain("plate")
    const tube = top("S6 C6 S7 C7 S8 C8", 9)
    expect(readPlay(cards("S7 C7 S8 C8 H9 H9"), 9, tube)).toMatchObject({ type: "tube" })
  })
})

describe("beating a play", () => {
  it("needs the same shape and a higher rank", () => {
    expect(beats(top("S8 H8"), top("S7 H7"))).toBe(true)
    expect(beats(top("S7 H7"), top("C7 D7"))).toBe(false)
    expect(beats(top("S8 H8 C8"), top("S7 H7"))).toBe(false)
    expect(beats(top("bj"), top("sj"))).toBe(true)
  })

  it("orders bombs by size, with the straight flush between five and six cards", () => {
    const four = top("S9 H9 C9 D9")
    const five = top("S3 H3 C3 D3 S3")
    const flush = top("S3 S4 S5 S6 S7")
    const six = top("S4 H4 C4 D4 S4 H4")
    const jokers = top("sj sj bj bj")
    expect(beats(four, top("bj bj"))).toBe(true)
    expect(beats(five, four)).toBe(true)
    expect(beats(four, five)).toBe(false)
    expect(beats(flush, five)).toBe(true)
    expect(beats(six, flush)).toBe(true)
    expect(beats(flush, six)).toBe(false)
    expect(beats(jokers, top("S4 H4 C4 D4 S4 H4 C4 D4"))).toBe(true)
  })
})

describe("listing legal plays", () => {
  it("finds wild-card plays and only those that beat the table", () => {
    const hand = cards("H5 S9 C9 D3 S4")
    const lead = legalPlays(hand, 5, null)
    expect(lead.some((c) => c.type === "triple" && c.rank === 9)).toBe(true)
    expect(lead.some((c) => c.type === "pair" && c.rank === 4)).toBe(true)
    const follow = legalPlays(hand, 5, top("S8 C8", 5))
    expect(follow.every((c) => c.type === "pair" && c.rank > 8)).toBe(true)
    expect(follow.length).toBeGreaterThan(0)
  })

  it("only returns plays the classifier accepts", () => {
    const state = newMatch(seeded(7))
    for (const combo of legalPlays(state.hands[0], 2, null)) {
      const readings = classify(combo.cards, 2)
      expect(readings.some((r) => r.type === combo.type && r.rank === combo.rank)).toBe(true)
    }
  })
})

function playOut(state: GameState): GameState {
  let turns = 0
  while (state.phase === "play") {
    const { combo } = advise(state, state.turn)
    state = combo ? play(state, state.turn, combo.cards) : pass(state, state.turn)
    if (++turns > 2000) throw new Error("hand did not finish")
  }
  return state
}

function returnAll(state: GameState): GameState {
  while (state.phase === "return") {
    const pending = state.tributes.find((t) => !t.returned)!
    const card = chooseReturn(state.hands[pending.to], state.level)
    state = returnTribute(state, pending.to, card.id)
  }
  return state
}

describe("game flow", () => {
  it("deals 27 cards each and makes the leader play", () => {
    const state = newMatch(seeded(1))
    expect(state.hands.map((h) => h.length)).toEqual([27, 27, 27, 27])
    expect(() => pass(state, state.turn)).toThrow()
    expect(checkPlay(state, (state.turn + 1) % 4, [state.hands[0][0]]).ok).toBe(false)
  })

  it("explains an illegal play", () => {
    const state = newMatch(seeded(1))
    const hand = state.hands[state.turn]
    const mismatch = [hand[0], hand[26]]
    const check = checkPlay(state, state.turn, mismatch)
    expect(check.ok).toBe(false)
    if (!check.ok) expect(check.reason).toContain("不能组成牌型")
  })

  it("plays whole matches between bots without breaking the rules", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const random = seeded(seed)
      let state = newMatch(random)
      let hands = 0
      for (;;) {
        state = playOut(returnAll(state))
        const result = state.result!
        expect(new Set(result.order).size).toBe(4)
        expect(result.gain).toBeGreaterThanOrEqual(1)
        expect(result.gain).toBeLessThanOrEqual(3)
        if (state.phase === "matchOver") break
        if (++hands > 300) throw new Error("match did not finish")
        const before = state
        state = startNextHand(state, random)
        expect(state.level).toBe(before.levels[result.winnerTeam])
        expect(state.hands.reduce((n, h) => n + h.length, 0)).toBe(108)
        for (const tribute of state.tributes) {
          expect(result.order.indexOf(tribute.from)).toBeGreaterThan(result.order.indexOf(tribute.to))
        }
        if (state.tributes.length > 0) expect(state.turn).toBe(state.tributes[0].from)
      }
      expect(state.result!.matchWinner).not.toBeNull()
      expect(state.levels[state.result!.matchWinner!]).toBe(14)
    }
  })

  it("hands the lead to the partner when a finished player's last play stands", () => {
    let state = newMatch(seeded(3))
    const leader = state.turn
    state = { ...state, hands: state.hands.map((h, p) => (p === leader ? cards("bj") : h)) }
    state = play(state, leader, state.hands[leader])
    expect(state.finished).toEqual([leader])
    for (let i = 0; i < 3; i++) {
      const bombs = legalPlays(state.hands[state.turn], 2, state.lastPlay!.combo)
      expect(state.turn).not.toBe(leader)
      if (bombs.length > 0) return
      state = pass(state, state.turn)
    }
    expect(state.lastPlay).toBeNull()
    expect(state.turn).toBe((leader + 2) % 4)
  })

  it("only accepts a 10 or lower as return tribute while one is held", () => {
    const hand = cards("bj SK S10 D4")
    expect(canReturn(hand, hand[0])).toBe(false)
    expect(canReturn(hand, hand[1])).toBe(false)
    expect(canReturn(hand, hand[2])).toBe(true)
    expect(canReturn(hand, hand[3])).toBe(true)
    const high = cards("bj SK SJ")
    expect(canReturn(high, high[2])).toBe(true)
  })

  it("keeps bots from bombing while every opponent still holds a full hand", () => {
    let bombs = 0
    for (const seed of [11, 12, 13, 14, 15, 16]) {
      let state = newMatch(seeded(seed))
      for (let i = 0; i < 12 && state.phase === "play"; i++) {
        const { combo } = advise(state, state.turn)
        if (combo && state.lastPlay && ["bomb", "straightFlush", "jokerBomb"].includes(combo.type)) bombs++
        state = combo ? play(state, state.turn, combo.cards) : pass(state, state.turn)
      }
    }
    expect(bombs).toBe(0)
  })
})

describe("advanced defence", () => {
  function table(mine: string, counts: [number, number, number]): GameState {
    const base = newMatch(seeded(5))
    const hands = [cards(mine), ...counts.map((n, i) => base.hands[i + 1].slice(0, n))]
    return { ...base, hands, turn: 0, lastPlay: null, log: [] }
  }

  it("does not lead a single into an opponent holding one card", () => {
    const state = table("S3 S9 C9 SK D6 D6 C7", [1, 12, 12])
    expect(advise(state, 0).combo!.type).not.toBe("single")
  })

  it("leads its lowest single to a partner holding one card", () => {
    const state = table("S3 S9 C9 SK DQ", [9, 1, 9])
    expect(advise(state, 0).combo).toMatchObject({ type: "single", rank: 3 })
  })

  it("plays high over its partner when the next opponent could go out", () => {
    const state = table("S8 SA C9 D9 D4", [1, 9, 9])
    const partnerPlay = classify(cards("S5"), 2)[0]
    const blocked = advise({ ...state, lastPlay: { player: 2, combo: partnerPlay } }, 0)
    expect(blocked.combo).toMatchObject({ type: "single", rank: 14 })
  })

  it("makes the simpler levels weaker, not different in rules", () => {
    const state = newMatch(seeded(9))
    for (const skill of ["novice", "basic", "advanced"] as const) {
      const { combo } = advise(state, state.turn, skill, seeded(3))
      expect(combo).not.toBeNull()
      expect(checkPlay(state, state.turn, combo!.cards).ok).toBe(true)
    }
  })
})

describe("saving a match between hands", () => {
  it("resumes with the same levels, hand count and tribute as playing straight on", () => {
    const ended = playOut(newMatch(seeded(21)))
    const save = parseSave(JSON.stringify(toSave(ended)))!
    expect(save).not.toBeNull()
    const straightOn = startNextHand(ended, seeded(77))
    const resumed = resumeMatch(save, seeded(77))
    expect(resumed.handNumber).toBe(2)
    expect(resumed.levels).toEqual(ended.levels)
    expect(resumed.level).toBe(straightOn.level)
    expect(resumed.turn).toBe(straightOn.turn)
    expect(resumed.tributes.map((t) => [t.from, t.to, t.card.id])).toEqual(
      straightOn.tributes.map((t) => [t.from, t.to, t.card.id]),
    )
    expect(resumed.hands.reduce((n, h) => n + h.length, 0)).toBe(108)
  })

  it("saves nothing mid-hand and rejects damaged saves", () => {
    expect(toSave(newMatch(seeded(2)))).toBeNull()
    const good = JSON.stringify(toSave(playOut(newMatch(seeded(21)))))
    expect(parseSave(null)).toBeNull()
    expect(parseSave("not json")).toBeNull()
    expect(parseSave(good.replace('"version":1', '"version":9'))).toBeNull()
    expect(parseSave(good.replace(/"levels":\[\d+,\d+\]/, '"levels":[2,99]'))).toBeNull()
    expect(parseSave(good.replace(/"order":\[\d,\d,\d,\d\]/, '"order":[0,0,1,2]'))).toBeNull()
  })
})


describe("rules a linter cannot check", () => {
  const SKILLS: Skill[] = ["novice", "basic", "advanced"]

  /** The same position with the cards the player cannot see dealt differently among the other seats. */
  function reshuffleHidden(state: GameState, player: number, random: () => number): GameState {
    const hidden = shuffle(state.hands.flatMap((hand, p) => (p === player ? [] : hand)), random)
    let taken = 0
    const hands = state.hands.map((hand, p) => {
      if (p === player) return hand
      taken += hand.length
      return hidden.slice(taken - hand.length, taken)
    })
    return { ...state, hands, dealt: state.dealt.map((hand, p) => (p === player ? hand : [])) }
  }

  it("bots do not peek: advice ignores which hidden cards the other players hold", () => {
    let checked = 0
    for (const seed of [11, 12, 13, 14]) {
      let state = newMatch(seeded(seed))
      while (state.phase === "play") {
        const player = state.turn
        for (const deal of [1, 2, 3]) {
          const other = reshuffleHidden(state, player, seeded(seed * 1000 + checked * 10 + deal))
          for (const skill of SKILLS) {
            const here = advise(state, player, skill, seeded(checked))
            const there = advise(other, player, skill, seeded(checked))
            expect(there.reason).toBe(here.reason)
            expect(there.combo?.cards.map((c) => c.id)).toEqual(here.combo?.cards.map((c) => c.id))
          }
        }
        const { combo } = advise(state, player)
        state = combo ? play(state, player, combo.cards) : pass(state, player)
        checked++
      }
    }
    expect(checked).toBeGreaterThan(100)
  })

  it("every reason shown to the player is written in Chinese", () => {
    let state = newMatch(seeded(12))
    const reasons = new Set<string>()
    while (state.phase === "play") {
      for (const skill of SKILLS) reasons.add(advise(state, state.turn, skill, seeded(3)).reason)
      const hand = state.hands[state.turn]
      const check = checkPlay(state, state.turn, [hand[0], hand[hand.length - 1]])
      if (!check.ok) reasons.add(check.reason)
      const { combo } = advise(state, state.turn)
      state = combo ? play(state, state.turn, combo.cards) : pass(state, state.turn)
    }
    expect(reasons.size).toBeGreaterThan(5)
    for (const reason of reasons) expect(reason).toMatch(/[\u4e00-\u9fff]/)
  })
})
