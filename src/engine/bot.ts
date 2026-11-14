import { ACE, BIG_JOKER, SMALL_JOKER, cardValue, isWild, rankValue } from "./cards"
import type { Card } from "./cards"
import { bombPower, classify, comboTypeName, describeCombo, legalPlays } from "./combos"
import type { Combo, ComboType } from "./combos"
import { canReturn, partnerOf, teamOf } from "./game"
import type { GameState } from "./game"

export type Skill = "novice" | "basic" | "advanced"

const ALL_RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, SMALL_JOKER, BIG_JOKER]

/** Whether cards nobody has shown yet could still form `count` of a kind above `value`. */
function higherExists(unseen: Map<number, number>, level: number, value: number, count: number): boolean {
  const wild = unseen.get(-1) ?? 0
  return ALL_RANKS.some((rank) => {
    if (rankValue(rank, level) <= value) return false
    const have = unseen.get(rank) ?? 0
    return rank >= SMALL_JOKER ? have >= count : have >= 1 && have + wild >= count
  })
}

/**
 * Rough count of the turns a hand still needs, lower is better.
 * Bombs, wild cards and top cards count in the hand's favour because they win the lead back.
 */
export function evaluateHand(hand: Card[], level: number, unseen?: Map<number, number>): number {
  if (hand.length === 0) return -100
  const counts = new Map<number, number>()
  let score = 0
  for (const card of hand) {
    if (isWild(card, level)) score -= 1.5
    else counts.set(card.rank, (counts.get(card.rank) ?? 0) + 1)
  }
  if ((counts.get(16) ?? 0) + (counts.get(17) ?? 0) === 4) {
    score -= 3
    counts.delete(16)
    counts.delete(17)
  }
  for (const [rank, count] of counts) {
    if (count >= 4) {
      score -= 0.5 + (count - 4) * 0.3
      counts.delete(rank)
    }
  }

  const at = (n: number) => counts.get(n === 1 ? ACE : n) ?? 0
  for (let top = ACE; top >= 5; top--) {
    let singles = 0
    let complete = true
    for (let n = top - 4; n <= top; n++) {
      if (at(n) === 0) complete = false
      if (at(n) === 1) singles++
    }
    if (!complete || singles < 3) continue
    for (let n = top - 4; n <= top; n++) {
      const rank = n === 1 ? ACE : n
      const left = at(n) - 1
      if (left === 0) counts.delete(rank)
      else counts.set(rank, left)
    }
    score += 1
    top++
  }

  let triples = 0
  let pairs = 0
  for (const [rank, count] of counts) {
    const value = rankValue(rank, level)
    if (count === 3) triples++
    else if (count === 2) pairs++
    score += 1
    if (unseen && count <= 3 && !higherExists(unseen, level, value, count)) score -= 0.7
    else if (value >= 15) score -= 0.5
    else if (value === ACE) score -= 0.2
    else if (count === 1 && value < 10) score += 0.2
  }
  return score - Math.min(triples, pairs)
}

function without(hand: Card[], cards: Card[]): Card[] {
  const ids = new Set(cards.map((c) => c.id))
  return hand.filter((c) => !ids.has(c.id))
}

export interface Advice {
  combo: Combo | null
  reason: string
}

interface Reading {
  /** Cards not in this hand and not yet played, by rank; key -1 counts unseen wild cards. */
  unseen: Map<number, number>
  partnerLead: ComboType | null
}

/** What a player can work out from their own hand and the cards played so far. */
function readTable(state: GameState, player: number): Reading {
  const unseen = new Map<number, number>(ALL_RANKS.map((rank) => [rank, rank >= SMALL_JOKER ? 2 : 8]))
  unseen.set(-1, 2)
  const see = (card: Card) => {
    unseen.set(card.rank, (unseen.get(card.rank) ?? 0) - 1)
    if (isWild(card, state.level)) unseen.set(-1, (unseen.get(-1) ?? 0) - 1)
  }
  state.hands[player].forEach(see)
  let partnerLead: ComboType | null = null
  let last: { player: number; combo: Combo } | null = null
  for (const record of state.log) {
    if (!record.combo) continue
    record.combo.cards.forEach(see)
    const led = !last || last.player === record.player || (bombPower(record.combo) === 0 && record.combo.type !== last.combo.type)
    if (led && record.player === partnerOf(player) && bombPower(record.combo) === 0) partnerLead = record.combo.type
    last = { player: record.player, combo: record.combo }
  }
  return { unseen, partnerLead }
}

/** True when no ordinary play from the unseen cards can beat this one (bombs aside). */
function isTop(combo: Combo, reading: Reading, level: number): boolean {
  const { unseen } = reading
  const wild = unseen.get(-1) ?? 0
  const left = (n: number) => unseen.get(n === 1 ? ACE : n) ?? 0
  const runAbove = (length: number, each: number) => {
    for (let top = combo.rank + 1; top <= ACE; top++) {
      let missing = 0
      for (let n = top - length + 1; n <= top; n++) missing += Math.max(0, each - left(n))
      if (missing <= wild) return true
    }
    return false
  }
  switch (combo.type) {
    case "single":
      return !higherExists(unseen, level, combo.rank, 1)
    case "pair":
      return !higherExists(unseen, level, combo.rank, 2)
    case "triple":
    case "fullHouse":
      return !higherExists(unseen, level, combo.rank, 3)
    case "straight":
      return !runAbove(5, 1)
    case "tube":
      return !runAbove(3, 2)
    case "plate":
      return !runAbove(2, 3)
    default:
      return bombPower(combo) >= 6
  }
}

interface Scored {
  combo: Combo
  score: number
}

function simple(state: GameState, player: number, random: () => number, careless: boolean): Advice {
  const hand = state.hands[player]
  const level = state.level
  const previous = state.lastPlay
  const options = legalPlays(hand, level, previous?.combo ?? null)
  const finishing = options.find((o) => o.cards.length === hand.length)
  if (finishing) return { combo: finishing, reason: "这手牌出完就走了。" }
  const plain = options.filter((o) => bombPower(o) === 0)
  const pool = plain.length > 0 ? plain : options
  const scored = pool
    .map((combo) => ({ combo, score: evaluateHand(without(hand, combo.cards), level) + combo.rank / 100 }))
    .sort((a, b) => a.score - b.score)
  if (!previous) {
    const pick = scored[careless ? Math.min(scored.length - 1, Math.floor(random() * 3)) : 0]
    return { combo: pick.combo, reason: `先出${describeCombo(pick.combo, level)}。` }
  }
  if (scored.length === 0 || teamOf(previous.player) === teamOf(player)) {
    return { combo: null, reason: "不出。" }
  }
  const best = scored[0]
  const lazy = careless && random() < 0.25
  const tooEarly = bombPower(best.combo) > 0 && Math.min(...state.hands.map((h) => h.length || 99)) > 8
  if (lazy || tooEarly || best.score > evaluateHand(hand, level) + 0.5) return { combo: null, reason: "不出。" }
  return { combo: best.combo, reason: `用${describeCombo(best.combo, level)}压住。` }
}

/** The play a careful player would make here, with a one-line reason. Used by bots and by hints. */
export function advise(
  state: GameState,
  player: number,
  skill: Skill = "advanced",
  random: () => number = Math.random,
): Advice {
  if (skill !== "advanced") return simple(state, player, random, skill === "novice")

  const hand = state.hands[player]
  const level = state.level
  const previous = state.lastPlay
  const options = legalPlays(hand, level, previous?.combo ?? null)

  const finishing = options.find((o) => o.cards.length === hand.length)
  if (finishing) return { combo: finishing, reason: "这手牌出完就走了。" }

  const reading = readTable(state, player)
  if (hand.length <= 12) {
    const setUp = options.find(
      (o) => isTop(o, reading, level) && classify(without(hand, o.cards), level).length > 0,
    )
    if (setUp) return { combo: setUp, reason: "这手牌没人压得住（除非炸弹），下一手就能出完。" }
  }

  const partner = partnerOf(player)
  const next = (player + 1) % 4
  const opponents = [next, (player + 3) % 4].filter((p) => state.hands[p].length > 0)
  const left = (p: number) => state.hands[p].length
  const threat = Math.min(99, ...opponents.map(left))
  const partnerLeft = left(partner)
  const opponentOut = state.finished.some((p) => teamOf(p) !== teamOf(player))
  const stay = evaluateHand(hand, level, reading.unseen)
  const seat = (p: number) => (p === next ? "下家" : "上家")

  const rate = (combo: Combo): number =>
    evaluateHand(without(hand, combo.cards), level, reading.unseen) +
    (combo.type === "straightFlush" ? 2 : bombPower(combo) > 0 ? 0 : combo.rank / 100)
  const plain = options.filter((o) => bombPower(o) === 0)

  if (!previous) {
    const pool = plain.length > 0 ? plain : options
    let note = ""
    const scored: Scored[] = pool.map((combo) => {
      let score = rate(combo)
      const size = combo.cards.length
      for (const p of opponents) {
        if (left(p) > 6 || left(p) !== size || isTop(combo, reading, level)) continue
        score += p === next ? 4 : 3
        if (left(p) === 1) score -= combo.rank / 5
      }
      const feed =
        partnerLeft > 0 && partnerLeft <= 5 && hand.length > partnerLeft && size === partnerLeft && left(next) !== size
      if (feed) score -= (opponentOut || partnerLeft <= 2 ? 5 : 1.5) - combo.rank / 20
      const support = partnerLeft > 0 && (opponentOut || partnerLeft + 4 < hand.length)
      if (support && reading.partnerLead === combo.type && combo.rank < 10) score -= 0.6
      return { combo, score }
    })
    scored.sort((a, b) => a.score - b.score)
    const pick = scored[0].combo
    const size = pick.cards.length
    const natural = pool.map((combo) => ({ combo, score: rate(combo) })).sort((a, b) => a.score - b.score)[0].combo
    const avoided = opponents.find((p) => left(p) <= 6 && left(p) === natural.cards.length && left(p) !== size)
    if (partnerLeft > 0 && partnerLeft <= 5 && size === partnerLeft && hand.length > partnerLeft && left(next) !== size) {
      note = `对家只剩 ${partnerLeft} 张，出小的${comboTypeName(pick.type)}送他走。`
    } else if (avoided !== undefined) {
      note = `${seat(avoided)}只剩 ${left(avoided)} 张，不出${left(avoided)}张的牌型，免得被他接走。`
    } else if (threat === 1 && pick.type === "single") {
      note = "对手只剩 1 张，单张要从大的出。"
    } else {
      note = `先出${describeCombo(pick, level)}，剩下的牌最好打。`
    }
    return { combo: pick, reason: note }
  }

  const scored: Scored[] = options.map((combo) => ({ combo, score: rate(combo) })).sort((a, b) => a.score - b.score)
  const best = scored[0]
  if (!best) return { combo: null, reason: "手里没有能压住的牌，过牌。" }

  const size = previous.combo.cards.length
  const fromPartner = teamOf(previous.player) === teamOf(player)
  const nextCanGoOut = left(next) > 0 && left(next) <= 3 && left(next) === size
  const highest = plain.slice().sort((a, b) => b.rank - a.rank)[0]

  if (fromPartner) {
    if (nextCanGoOut && highest && !isTop(previous.combo, reading, level) && partnerLeft > size) {
      return {
        combo: highest,
        reason: `下家只剩 ${left(next)} 张，用大牌顶住，不让他轻松接过去。`,
      }
    }
    const cheap = bombPower(best.combo) === 0 && best.score <= stay - 1 && previous.combo.rank < 10 && partnerLeft > 5
    if (cheap) return { combo: best.combo, reason: "对家出的牌小，顺势垫一手，把弱牌送走。" }
    return { combo: null, reason: "这一轮对家最大，让对家继续出牌。" }
  }

  if (nextCanGoOut && highest && previous.player !== next) {
    return { combo: highest, reason: `下家只剩 ${left(next)} 张，用大牌顶住，不让他轻松接过去。` }
  }

  const who = previous.player
  const mustStop = left(who) <= 3 || (opponentOut && left(who) <= 10)
  const urgent = threat <= 8 || hand.length <= 10 || opponentOut
  const choice = urgent ? best : scored.find((o) => bombPower(o.combo) === 0)
  if (!choice) return { combo: null, reason: "只有炸弹能压，现在用还太早，先过。" }

  const usesBomb = bombPower(choice.combo) > 0
  let margin = 0.3
  if (threat <= 6) margin += 1.5
  if (hand.length <= 8) margin += 1
  if (size >= 5) margin += 0.3
  if (who === next) margin += 0.5
  if (opponentOut) margin += 1
  if (mustStop) margin += 5
  if (choice.score <= stay + margin) {
    const why = mustStop
      ? left(who) === 0
        ? "对手刚出完，压住这手牌抢下出牌权，不让他的对家接风。"
        : `${seat(who)}只剩 ${left(who)} 张，一定要压住，不能让他走。`
      : usesBomb
        ? threat <= 8
          ? "对手快出完了，值得用炸弹抢回出牌权。"
          : "你的牌不多了，用炸弹抢出牌权很划算。"
        : `用${describeCombo(choice.combo, level)}压住，不会拆散更好的牌型。`
    return { combo: choice.combo, reason: why }
  }
  return {
    combo: null,
    reason: usesBomb ? "只有炸弹能压，现在用还太早，先过。" : "压这手牌要拆散好牌型，先过，等机会。",
  }
}

/** The card a bot gives back after receiving tribute: its least useful low card. */
export function chooseReturn(hand: Card[], level: number): Card {
  const allowed = hand.filter((c) => canReturn(hand, c) && !isWild(c, level))
  let best = allowed[0]
  let bestScore = Infinity
  for (const card of allowed) {
    const score = evaluateHand(without(hand, [card]), level) + cardValue(card, level) / 100
    if (score < bestScore) {
      best = card
      bestScore = score
    }
  }
  return best
}
