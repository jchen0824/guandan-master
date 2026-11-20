// What a finished hand is worth: its 役, 番 and 符. A hand can be read as sets in more than one way, and the
// winning tile can finish more than one of them; `valueOf` tries every reading and keeps the dearest.
import { basePoints, limitName } from "./score"
import { thirteenOrphansShanten } from "./shanten"
import { EAST, GREEN, KINDS, indexOf, isDragon, isHonor, isTerminal, isYaochu, suitOf, kindName } from "./tiles"
import type { Kind } from "./tiles"

/** A set a player has called or declared. `kind` is the lowest tile of a 吃, or the tile of the others. */
export interface CalledSet {
  type: "chi" | "pon" | "minkan" | "ankan" | "kakan"
  kind: Kind
}

export interface WinInput {
  /** The concealed tiles as 34 counts, the winning tile among them. */
  counts: readonly number[]
  called: readonly CalledSet[]
  winKind: Kind
  tsumo: boolean
  seatWind: Kind
  roundWind: Kind
  /** 0 no 立直, 1 立直, 2 双立直. */
  riichi: 0 | 1 | 2
  ippatsu: boolean
  /** Won on the tile drawn after a 杠. */
  rinshan: boolean
  /** Won on the tile another player added to a 碰. */
  chankan: boolean
  /** Won on the last tile of the wall, or on the discard after it. */
  lastTile: boolean
  /** Won on the very first draw, before anyone called. */
  firstTurn: boolean
  dealer: boolean
  dora: number
  ura: number
}

export interface Yaku {
  name: string
  han: number
}

export interface WinValue {
  /** The 役, then 宝牌 and 里宝牌 when the hand has any. */
  yaku: Yaku[]
  han: number
  fu: number
  /** How many 役满 the hand holds; the 番 and 符 do not matter then. */
  yakuman: number
  base: number
  /** 满贯, 跳满 and so on, or null for a smaller hand. */
  limit: string | null
}

interface Group {
  run: boolean
  kind: Kind
  /** Called, or a triplet finished by another player's discard. */
  open: boolean
  quad: boolean
}

type Wait = "two-sided" | "middle" | "edge" | "pair" | "triplets"

interface Reading {
  pair: Kind
  sets: { run: boolean; kind: Kind }[]
}

/** Every way to read concealed tiles as sets and one pair. */
export function readings(counts: readonly number[]): Reading[] {
  const left = counts.slice()
  const found: Reading[] = []
  const sets: Reading["sets"] = []
  const walk = (pair: Kind, start: number) => {
    let i = start
    while (i < KINDS && left[i] === 0) i++
    if (i >= KINDS) {
      found.push({ pair, sets: sets.slice() })
      return
    }
    if (left[i] >= 3) {
      left[i] -= 3
      sets.push({ run: false, kind: i })
      walk(pair, i)
      sets.pop()
      left[i] += 3
    }
    if (!isHonor(i) && indexOf(i) <= 6 && left[i + 1] > 0 && left[i + 2] > 0) {
      for (const k of [i, i + 1, i + 2]) left[k]--
      sets.push({ run: true, kind: i })
      walk(pair, i)
      sets.pop()
      for (const k of [i, i + 1, i + 2]) left[k]++
    }
  }
  for (let pair = 0; pair < KINDS; pair++) {
    if (left[pair] < 2) continue
    left[pair] -= 2
    walk(pair, 0)
    left[pair] += 2
  }
  return found
}

const GREENS = new Set([19, 20, 21, 23, 25, GREEN])
const hasYaochu = (group: Group) => (group.run ? indexOf(group.kind) === 0 || indexOf(group.kind) === 6 : isYaochu(group.kind))
const kindsOf = (group: Group) => (group.run ? [group.kind, group.kind + 1, group.kind + 2] : [group.kind])

interface Found {
  yaku: Yaku[]
  yakuman: string[]
  fu: number
}

/** The 役 that depend on how the hand was won and not on its tiles. */
function luck(input: WinInput, closed: boolean): Yaku[] {
  const yaku: Yaku[] = []
  if (input.riichi === 2) yaku.push({ name: "双立直", han: 2 })
  else if (input.riichi === 1) yaku.push({ name: "立直", han: 1 })
  if (input.riichi > 0 && input.ippatsu) yaku.push({ name: "一发", han: 1 })
  if (closed && input.tsumo) yaku.push({ name: "门前清自摸和", han: 1 })
  if (input.rinshan) yaku.push({ name: "岭上开花", han: 1 })
  if (input.chankan) yaku.push({ name: "抢杠", han: 1 })
  if (input.lastTile && !input.rinshan) yaku.push({ name: input.tsumo ? "海底摸月" : "河底捞鱼", han: 1 })
  return yaku
}

function flush(kinds: Kind[], closed: boolean): Yaku[] {
  const suits = new Set(kinds.filter((kind) => !isHonor(kind)).map(suitOf))
  if (suits.size !== 1) return []
  return kinds.some(isHonor) ? [{ name: "混一色", han: closed ? 3 : 2 }] : [{ name: "清一色", han: closed ? 6 : 5 }]
}

function firstTurnYakuman(input: WinInput): string[] {
  return input.firstTurn && input.tsumo ? [input.dealer ? "天和" : "地和"] : []
}

function readStandard(input: WinInput, groups: Group[], pair: Kind, wait: Wait, closed: boolean): Found {
  const triplets = groups.filter((group) => !group.run)
  const runs = groups.filter((group) => group.run)
  const concealed = triplets.filter((group) => !group.open)
  const quads = groups.filter((group) => group.quad)
  const kinds = [...groups.flatMap(kindsOf), pair]
  const valued = (kind: Kind) => isDragon(kind) || kind === input.seatWind || kind === input.roundWind
  const dragons = triplets.filter((group) => isDragon(group.kind)).length
  const winds = triplets.filter((group) => isHonor(group.kind) && !isDragon(group.kind)).length
  const pairIsWind = isHonor(pair) && !isDragon(pair)

  const yakuman = firstTurnYakuman(input)
  if (concealed.length === 4) yakuman.push("四暗刻")
  if (dragons === 3) yakuman.push("大三元")
  if (winds === 4) yakuman.push("大四喜")
  else if (winds === 3 && pairIsWind) yakuman.push("小四喜")
  if (kinds.every(isHonor)) yakuman.push("字一色")
  if (kinds.every(isTerminal)) yakuman.push("清老头")
  if (kinds.every((kind) => GREENS.has(kind))) yakuman.push("绿一色")
  if (quads.length === 4) yakuman.push("四杠子")
  if (closed && input.called.length === 0 && !isHonor(pair) && kinds.every((kind) => !isHonor(kind) && suitOf(kind) === suitOf(pair))) {
    const from = suitOf(pair) * 9
    if ([3, 1, 1, 1, 1, 1, 1, 1, 3].every((need, i) => input.counts[from + i] >= need)) yakuman.push("九莲宝灯")
  }
  if (yakuman.length > 0) return { yaku: [], yakuman, fu: 0 }

  const pinfu = closed && runs.length === 4 && !valued(pair) && wait === "two-sided"
  const yaku = luck(input, closed)
  if (pinfu) yaku.push({ name: "平和", han: 1 })
  if (kinds.every((kind) => !isYaochu(kind))) yaku.push({ name: "断幺九", han: 1 })
  if (closed) {
    const seen = new Map<Kind, number>()
    for (const group of runs) seen.set(group.kind, (seen.get(group.kind) ?? 0) + 1)
    const doubled = [...seen.values()].reduce((sum, count) => sum + Math.floor(count / 2), 0)
    if (doubled === 2) yaku.push({ name: "二杯口", han: 3 })
    else if (doubled === 1) yaku.push({ name: "一杯口", han: 1 })
  }
  for (const group of triplets) {
    if (isDragon(group.kind)) yaku.push({ name: `役牌 ${kindName(group.kind)}`, han: 1 })
    if (group.kind === input.roundWind) yaku.push({ name: `场风 ${kindName(group.kind)}`, han: 1 })
    if (group.kind === input.seatWind) yaku.push({ name: `自风 ${kindName(group.kind)}`, han: 1 })
  }
  const allYaochu = groups.every(hasYaochu) && isYaochu(pair)
  if (allYaochu && runs.length > 0) {
    yaku.push(kinds.some(isHonor) ? { name: "混全带幺九", han: closed ? 2 : 1 } : { name: "纯全带幺九", han: closed ? 3 : 2 })
  }
  if (allYaochu && runs.length === 0) yaku.push({ name: "混老头", han: 2 })
  const starts = new Set(runs.map((group) => group.kind))
  if ([0, 9, 18].some((from) => [0, 3, 6].every((step) => starts.has(from + step)))) yaku.push({ name: "一气通贯", han: closed ? 2 : 1 })
  if (runs.some((group) => [0, 9, 18].every((from) => starts.has(from + indexOf(group.kind))))) yaku.push({ name: "三色同顺", han: closed ? 2 : 1 })
  const tripled = new Set(triplets.map((group) => group.kind))
  if (triplets.some((group) => !isHonor(group.kind) && [0, 9, 18].every((from) => tripled.has(from + indexOf(group.kind))))) {
    yaku.push({ name: "三色同刻", han: 2 })
  }
  if (quads.length === 3) yaku.push({ name: "三杠子", han: 2 })
  if (triplets.length === 4) yaku.push({ name: "对对和", han: 2 })
  if (concealed.length === 3) yaku.push({ name: "三暗刻", han: 2 })
  if (dragons === 2 && isDragon(pair)) yaku.push({ name: "小三元", han: 2 })
  yaku.push(...flush(kinds, closed))

  if (pinfu) return { yaku, yakuman, fu: input.tsumo ? 20 : 30 }
  let fu = 20 + (closed && !input.tsumo ? 10 : 0) + (input.tsumo ? 2 : 0)
  for (const group of triplets) fu += (group.quad ? 8 : 2) * (group.open ? 1 : 2) * (isYaochu(group.kind) ? 2 : 1)
  fu += (isDragon(pair) ? 2 : 0) + (pair === input.seatWind ? 2 : 0) + (pair === input.roundWind ? 2 : 0)
  if (wait === "middle" || wait === "edge" || wait === "pair") fu += 2
  // An open hand of runs won on a discard has nothing to add; it is counted as 30.
  return { yaku, yakuman, fu: fu === 20 ? 30 : Math.ceil(fu / 10) * 10 }
}

function readSevenPairs(input: WinInput): Found | null {
  if (input.called.length > 0 || input.counts.filter((count) => count === 2).length !== 7) return null
  const kinds = input.counts.flatMap((count, kind) => (count === 2 ? [kind] : []))
  const yakuman = firstTurnYakuman(input)
  if (kinds.every(isHonor)) yakuman.push("字一色")
  if (yakuman.length > 0) return { yaku: [], yakuman, fu: 0 }
  const yaku = [...luck(input, true), { name: "七对子", han: 2 }]
  if (kinds.every((kind) => !isYaochu(kind))) yaku.push({ name: "断幺九", han: 1 })
  if (kinds.every(isYaochu)) yaku.push({ name: "混老头", han: 2 })
  yaku.push(...flush(kinds, true))
  return { yaku, yakuman, fu: 25 }
}

function readThirteenOrphans(input: WinInput): Found | null {
  if (input.called.length > 0 || thirteenOrphansShanten(input.counts) !== -1) return null
  return { yaku: [], yakuman: [...firstTurnYakuman(input), "国士无双"], fu: 0 }
}

/** How the winning tile sits in one set of a reading, or null when the set does not hold it. */
function waitIn(set: Reading["sets"][number], winKind: Kind): Wait | null {
  if (!set.run) return set.kind === winKind ? "triplets" : null
  const at = winKind - set.kind
  if (at < 0 || at > 2) return null
  if (at === 1) return "middle"
  return (at === 0 && indexOf(set.kind) === 6) || (at === 2 && indexOf(set.kind) === 0) ? "edge" : "two-sided"
}

function everyReading(input: WinInput): Found[] {
  const closed = input.called.every((set) => set.type === "ankan")
  const called: Group[] = input.called.map((set) => ({
    run: set.type === "chi",
    kind: set.kind,
    open: set.type !== "ankan",
    quad: set.type === "minkan" || set.type === "ankan" || set.type === "kakan",
  }))
  const found: Found[] = []
  for (const reading of readings(input.counts)) {
    const build = (finished: number) =>
      reading.sets.map((set, i) => ({ ...set, quad: false, open: !set.run && i === finished && !input.tsumo })).concat(called)
    if (reading.pair === input.winKind) found.push(readStandard(input, build(-1), reading.pair, "pair", closed))
    const tried = new Set<string>()
    reading.sets.forEach((set, i) => {
      const wait = waitIn(set, input.winKind)
      const key = `${set.run}${set.kind}`
      if (!wait || tried.has(key)) return
      tried.add(key)
      found.push(readStandard(input, build(i), reading.pair, wait, closed))
    })
  }
  const pairs = readSevenPairs(input)
  if (pairs) found.push(pairs)
  const orphans = readThirteenOrphans(input)
  if (orphans) found.push(orphans)
  return found
}

/** What the hand is worth, or null when it is not a finished hand or has no 役. 宝牌 alone are not a 役. */
export function valueOf(input: WinInput): WinValue | null {
  let best: WinValue | null = null
  for (const found of everyReading(input)) {
    if (found.yakuman.length === 0 && found.yaku.length === 0) continue
    const yakuman = found.yakuman.length
    const yaku = yakuman > 0 ? found.yakuman.map((name) => ({ name, han: 13 })) : found.yaku.slice()
    if (yakuman === 0 && input.dora > 0) yaku.push({ name: "宝牌", han: input.dora })
    if (yakuman === 0 && input.ura > 0) yaku.push({ name: "里宝牌", han: input.ura })
    const han = yaku.reduce((sum, item) => sum + item.han, 0)
    const base = basePoints(han, found.fu, yakuman)
    const value = { yaku, han, fu: found.fu, yakuman, base, limit: limitName(han, found.fu, yakuman) }
    if (!best || base > best.base || (base === best.base && han > best.han)) best = value
  }
  return best
}

/** The wind a seat sits in, as a tile kind: the dealer is 东 and the winds go round from there. */
export const seatWindOf = (seat: number, dealer: number): Kind => EAST + ((seat - dealer + 4) % 4)
