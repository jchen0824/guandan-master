// The Chinese the mahjong screen says, worked out from the table. Kept apart from the components so both they and
// the tests can use it.
import { HERO, RIICHI_STICK, SEAT_NAMES, legalActions, seatWind } from "../../mahjong/game"
import type { Action, MahjongState, Win } from "../../mahjong/game"
import { EAST, WIND_NAMES, kindName, points } from "../../mahjong/tiles"
import type { Kind } from "../../mahjong/tiles"

const FILES = ["Man", "Pin", "Sou"]
  .flatMap((suit) => Array.from({ length: 9 }, (_, i) => `${suit}${i + 1}`))
  .concat(["Ton", "Nan", "Shaa", "Pei", "Haku", "Hatsu", "Chun"])

/** Where a tile's picture is served from. */
export const tileImage = (kind: Kind) => `${import.meta.env.BASE_URL}mahjong/tiles/${FILES[kind]}.svg`

/** 东, 南, 西 or 北: the wind a seat sits in this hand. */
export const windOf = (game: MahjongState, seat: number) => WIND_NAMES[seatWind(game, seat) - EAST]

const NUMERALS = "一二三四五六七八九"
const SUITS = "万筒索"

/** What a button for this action says. */
export function actionLabel(action: Action): string {
  switch (action.type) {
    case "ron":
      return "荣和"
    case "tsumo":
      return "自摸"
    case "pon":
      return "碰"
    case "kan":
      return "杠"
    case "pass":
      return "过"
    case "abort":
      return "九种九牌流局"
    case "ankan":
    case "kakan":
      return `杠 ${kindName(action.kind)}`
    case "chi": {
      const at = action.low % 9
      return `吃 ${NUMERALS.slice(at, at + 3)}${SUITS[Math.floor(action.low / 9)]}`
    }
    default:
      return "打出"
  }
}

const CALLS: Partial<Record<Action["type"], string>> = { pon: "碰了", kan: "杠了", chi: "吃了", ankan: "暗杠", kakan: "加杠" }

/** One short line on what is happening at the table and what the player can do. */
export function statusLine(game: MahjongState, lifted = false): string {
  if (game.result) return game.over ? "比赛结束。" : "这一局结束了。"
  const last = game.actions[game.actions.length - 1]
  const called = last && CALLS[last.action.type] ? `${SEAT_NAMES[last.seat]}${CALLS[last.action.type]}。` : ""
  const me = game.players[HERO]
  if (game.phase === "call" && game.pending) {
    const { tile, from, kakan } = game.pending
    const what = `${SEAT_NAMES[from]}${kakan ? "加杠" : "打出"}${kindName(tile.kind)}`
    return legalActions(game, HERO).length > 0 ? `${what}，你可以鸣牌。` : `${what}。`
  }
  if (game.turn !== HERO) return `${called}等${SEAT_NAMES[game.turn]}出牌。`
  if (me.riichi > 0) return "你已经立直，摸到什么打什么。"
  const riichi = legalActions(game, HERO).some((action) => action.type === "discard" && action.riichi)
  if (lifted) return riichi ? "按打出，或者按立直宣布立直。" : "按打出，或者再点一次这张牌。"
  const drew = game.drawn ? `摸到${kindName(game.drawn.kind)}。` : called
  return riichi ? `${drew}听牌了：选一张带金边的牌，可以立直。` : `${drew}选一张牌打出。`
}

/** 立直 1 番 · 平和 1 番. */
export const yakuLine = (win: Win) => win.value.yaku.map((yaku) => (win.value.yakuman > 0 ? yaku.name : `${yaku.name} ${yaku.han} 番`)).join(" · ")

/** 30 符 3 番, or the name of the limit hand. */
export const worthLine = (win: Win) => win.value.limit ?? `${win.value.fu} 符 ${win.value.han} 番`

/** 对家荣和，下家放铳. */
export function winTitle(win: Win): string {
  return win.from === null ? `${SEAT_NAMES[win.seat]}自摸` : `${SEAT_NAMES[win.seat]}荣和，${SEAT_NAMES[win.from]}放铳`
}

/**
 * What each seat gained or lost over the whole hand: its share of the result, and a 立直 stick it put on the table.
 * The engine takes a stick when it is declared and gives every stick on the table to the winner, so the result's own
 * deltas leave the declarer's 1,000 out and count the winner's in, and do not add up to zero.
 */
export const handChanges = (game: MahjongState) => game.players.map((player, seat) => player.points - game.dealt.points[seat])

/** The seats that put a 立直 stick on the table during this hand. */
export function stickPayers(game: MahjongState): number[] {
  const { result } = game
  if (!result) return []
  return [0, 1, 2, 3].filter((seat) => game.dealt.points[seat] + result.deltas[seat] - game.players[seat].points === RIICHI_STICK)
}

/** What a win was worth by itself. The first winner also takes every 立直 stick on the table, which is not the hand's worth. */
export function winWorth(game: MahjongState, win: Win): number {
  const first = game.result?.kind === "win" && game.result.wins[0].seat === win.seat
  return win.deltas[win.seat] - (first ? (game.dealt.sticks + stickPayers(game).length) * RIICHI_STICK : 0)
}

/** 桌上 2 根立直棒（下家、对家立直时各付 1,000）归对家。, or null when there were none. */
export function sticksLine(game: MahjongState): string | null {
  const { result } = game
  if (!result) return null
  const payers = stickPayers(game)
  const carried = game.dealt.sticks
  const total = carried + payers.length
  if (total === 0) return null
  const paid = payers.length > 0 ? `${payers.map((seat) => SEAT_NAMES[seat]).join("、")}立直时${payers.length > 1 ? "各" : ""}付 ${points(RIICHI_STICK)}` : ""
  const left = carried === 0 ? "" : payers.length > 0 ? `${carried} 根是之前流局留下的` : "之前流局留下的"
  const where = result.kind === "win" ? `归${SEAT_NAMES[result.wins[0].seat]}` : "留给下一局和牌的人"
  return `桌上 ${total} 根立直棒（${[paid, left].filter(Boolean).join("，")}）${where}。`
}

/** +3,900 or -1,000. */
export const signed = (amount: number) => `${amount > 0 ? "+" : amount < 0 ? "-" : ""}${points(Math.abs(amount))}`

/** The headline of a finished hand. */
export function resultTitle(game: MahjongState): string {
  const { result } = game
  if (!result) return ""
  if (result.kind === "win") return result.wins.map(winTitle).join("；")
  if (result.kind === "abort") return `${result.reason}，这一局不算`
  const ready = result.tenpai.flatMap((is, seat) => (is ? [SEAT_NAMES[seat]] : []))
  return `荒牌流局，${ready.length > 0 ? `${ready.join("、")}听牌` : "没有人听牌"}`
}

/** The seats from first place to last, for the end of a match. A tie goes to the seat nearer the first dealer. */
export function ranking(game: MahjongState): number[] {
  const order = (seat: number) => (seat - game.firstDealer + 4) % 4
  return [0, 1, 2, 3].sort((a, b) => game.players[b].points - game.players[a].points || order(a) - order(b))
}
