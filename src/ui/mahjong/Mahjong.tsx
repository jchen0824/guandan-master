import { Button } from "@ui-sdk/react/button"
import { Dialog, DialogBackdrop, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@ui-sdk/react/dialog"
import { Field, FieldDescription, FieldLabel } from "@ui-sdk/react/field"
import { SegmentedControl, SegmentedControlItem } from "@ui-sdk/react/segmented-control"
import { useState } from "react"
import { HERO, MATCH_LENGTHS, SEAT_NAMES, handName, indicatorTiles } from "../../mahjong/game"
import type { Action, MahjongState, MatchLength, Meld, Win } from "../../mahjong/game"
import { byKind, kindName, points } from "../../mahjong/tiles"
import type { Kind, Tile } from "../../mahjong/tiles"
import { useMahjong } from "./useMahjong"
import { actionLabel, ranking, resultTitle, signed, statusLine, tileImage, windOf, winTitle, worthLine, yakuLine } from "./words"

const OPPONENTS = [1, 2, 3]
const MELD_NAMES: Record<Meld["type"], string> = { chi: "吃", pon: "碰", minkan: "杠", ankan: "暗杠", kakan: "杠" }
const LENGTH_NAMES: Record<MatchLength, string> = { 1: "东风战", 2: "半庄战" }
const LENGTH_NOTES: Record<MatchLength, string> = {
  1: "东风战：只打东场，每人至少坐一次庄，大约四局。适合先熟悉规则。",
  2: "半庄战：东场打完再打南场，大约八局。",
}

/** The picture on a tile. Its name is said by whatever holds it. */
function Face({ kind }: { kind: Kind }) {
  return <img data-slot="mj-face" src={tileImage(kind)} alt="" draggable={false} />
}

/** A tile that is only looked at: in a 牌河, a call, or a finished hand. */
function Shown({ tile, ...marks }: { tile: Tile; "data-riichi"?: string; "data-called"?: string; "data-last"?: string }) {
  return (
    <span data-slot="mj-tile" role="img" aria-label={kindName(tile.kind)} {...marks}>
      <Face kind={tile.kind} />
    </span>
  )
}

function River({ game, seat, last }: { game: MahjongState; seat: number; last: number | null }) {
  return (
    <section data-slot="mj-river" data-seat={seat} aria-label={`${SEAT_NAMES[seat]}的牌河`}>
      {game.players[seat].river.map((discard) => (
        <Shown
          key={discard.tile.id}
          tile={discard.tile}
          data-riichi={discard.riichi ? "" : undefined}
          data-called={discard.called ? "" : undefined}
          data-last={discard.tile.id === last ? "" : undefined}
        />
      ))}
    </section>
  )
}

function Melds({ game, seat }: { game: MahjongState; seat: number }) {
  const { melds } = game.players[seat]
  if (melds.length === 0) return null
  return (
    <div data-slot="mj-melds" data-seat={seat} role="group" aria-label={`${SEAT_NAMES[seat]}的鸣牌`}>
      {melds.map((meld) => (
        <span key={meld.tiles[0].id} data-slot="mj-meld" role="group" aria-label={`${MELD_NAMES[meld.type]} ${meld.tiles.map((tile) => kindName(tile.kind)).join("")}`}>
          {meld.tiles.map((tile) => (
            <Shown key={tile.id} tile={tile} />
          ))}
        </span>
      ))}
    </div>
  )
}

/**
 * The 68 places a stack of two tiles can stand in, clockwise from the top of 下家's side. Tiles are drawn from the
 * low end, so what is left is one run ending in the seven stacks of the dead wall, at the right of 对家's side.
 */
const STACKS = 68
const DEAD_FROM = STACKS - 7
/** Each side's places in the order they are drawn on screen: left to right, or top to bottom. */
const WALL_SIDES: [string, number[]][] = [
  ["top", Array.from({ length: 17 }, (_, i) => 51 + i)],
  ["right", Array.from({ length: 17 }, (_, i) => i)],
  ["bottom", Array.from({ length: 17 }, (_, i) => 33 - i)],
  ["left", Array.from({ length: 17 }, (_, i) => 50 - i)],
]

/** 牌山: the tiles still to draw, as stacks round the table, with the 宝牌 indicators face up on the dead wall. */
function Walls({ game }: { game: MahjongState }) {
  const live = Math.ceil(game.wall.length / 2)
  const height = (slot: number) => {
    if (slot >= DEAD_FROM) return 2
    if (slot < DEAD_FROM - live) return 0
    return slot === DEAD_FROM - live && game.wall.length % 2 === 1 ? 1 : 2
  }
  const shown = indicatorTiles(game)
  return (
    <div data-slot="mj-walls" role="img" aria-label={`牌山还剩 ${game.wall.length} 张`}>
      {WALL_SIDES.map(([side, slots]) => (
        <span key={side} data-slot="mj-wall-side" data-side={side}>
          {slots.map((slot) => {
            const indicator = shown[STACKS - 3 - slot]
            return (
              <span key={slot} data-slot="mj-stack" data-height={height(slot)}>
                {indicator ? <Face kind={indicator.kind} /> : null}
              </span>
            )
          })}
        </span>
      ))}
    </div>
  )
}

function Centre({ game }: { game: MahjongState }) {
  return (
    <div data-slot="mj-centre">
      <p data-slot="mj-wall">
        <span>牌山</span>
        <b>{game.wall.length}</b>
      </p>
      {game.players.map((player, seat) => (
        <p
          key={SEAT_NAMES[seat]}
          data-slot="mj-seat"
          data-seat={seat}
          data-dealer={seat === game.dealer ? "" : undefined}
          data-active={game.phase === "turn" && game.turn === seat ? "" : undefined}
          aria-label={`${SEAT_NAMES[seat]}，${windOf(game, seat)}家，${points(player.points)} 点${player.riichi > 0 ? "，已立直" : ""}`}
        >
          <span data-slot="mj-wind">{windOf(game, seat)}</span>
          <span data-slot="mj-name">{SEAT_NAMES[seat]}</span>
          <b>{points(player.points)}</b>
          {player.riichi > 0 ? <span data-slot="mj-riichi">立直</span> : null}
        </p>
      ))}
    </div>
  )
}

/** The winner's tiles as they are counted: the concealed ones, the winning tile set apart, then the calls. */
function WinningHand({ game, win }: { game: MahjongState; win: Win }) {
  const player = game.players[win.seat]
  const concealed = player.hand.filter((tile) => tile.id !== win.tile.id)
  return (
    <span data-slot="mj-won" role="group" aria-label={`${SEAT_NAMES[win.seat]}的和牌`}>
      {concealed.map((tile) => (
        <Shown key={tile.id} tile={tile} />
      ))}
      <span data-slot="mj-gap" />
      <Shown tile={win.tile} data-last="" />
      {player.melds.map((meld) => (
        <span key={meld.tiles[0].id} data-slot="mj-meld">
          {meld.tiles.map((tile) => (
            <Shown key={tile.id} tile={tile} />
          ))}
        </span>
      ))}
    </span>
  )
}

function Result({ game }: { game: MahjongState }) {
  const { result } = game
  if (!result) return null
  const places = ranking(game)
  return (
    <section data-slot="mj-result" role="status" aria-label="这一局的结果">
      <h2>{resultTitle(game)}</h2>
      {result.kind === "win"
        ? result.wins.map((win) => (
            <div key={win.seat} data-slot="mj-win">
              {result.wins.length > 1 ? <h3>{winTitle(win)}</h3> : null}
              <WinningHand game={game} win={win} />
              <p data-slot="mj-yaku">{yakuLine(win)}</p>
              <p data-slot="mj-worth">
                <b>{worthLine(win)}</b> {signed(win.deltas[win.seat])}
              </p>
            </div>
          ))
        : null}
      <ul data-slot="mj-deltas" aria-label="点数变化">
        {game.players.map((player, seat) => (
          <li key={SEAT_NAMES[seat]} data-up={result.deltas[seat] > 0 ? "" : undefined} data-down={result.deltas[seat] < 0 ? "" : undefined}>
            <span>{SEAT_NAMES[seat]}</span>
            <b>{points(player.points)}</b>
            <span>{result.deltas[seat] === 0 ? "不变" : signed(result.deltas[seat])}</span>
          </li>
        ))}
      </ul>
      {game.over ? (
        <p data-slot="mj-final">
          比赛结束：{places.map((seat, place) => `第 ${place + 1} 名 ${SEAT_NAMES[seat]}`).join("，")}。
        </p>
      ) : null}
    </section>
  )
}

function Rules() {
  return (
    <Dialog>
      <DialogTrigger data-variant="text">规则</DialogTrigger>
      <DialogBackdrop />
      <DialogContent initialFocus="content">
        <DialogTitle>日本麻将怎么打</DialogTitle>
        <DialogDescription>四个人轮流摸一张、打一张。先把手里的 14 张凑成四组加一对，并且至少有一个役，就和牌。</DialogDescription>
        <ul data-slot="rules-list">
          <li>牌有万、筒、索三种数牌（一到九），加上东南西北和白发中，每种四张，一共 136 张。一索画的是一只鸟，不是一根竹子；白是一张空白的牌。</li>
          <li>一组是三张连着的同种数牌（顺子），或三张一样的牌（刻子）。四组加一对相同的牌就是和牌的样子。七个对子、十三种幺九牌各一张也能和。</li>
          <li>别人打出的牌可以拿来用：上家打的能吃成顺子，谁打的都能碰成刻子，有三张一样的还能杠。鸣牌之后手牌就不算门前清，不能立直。</li>
          <li>和牌一定要有役。最常见的役：立直、门前清自摸、断幺九（没有一、九和字牌）、役牌（白发中，或场风、自风的刻子）、平和。只有宝牌不算役。</li>
          <li>立直：没鸣过牌、只差一张就和的时候，付 1,000 点宣布立直，之后摸到什么打什么，和了多一番。</li>
          <li>自己摸到是自摸，三家一起付；别人打出来是荣和，打的人一个人付。</li>
          <li>振听：你要的牌自己以前打过，或者刚才别人打了你没和，就不能荣和，只能自摸。</li>
          <li>宝牌：牌桌上方翻开的指示牌的下一张是宝牌，手里每有一张多一番。</li>
          <li>牌山摸完没人和就是流局，听牌的人从没听牌的人那里一共收 3,000 点。庄家和了或流局时听牌，就继续坐庄。</li>
          <li>每人 25,000 点开始。东风战打完东场结束，半庄战打完南场结束；有人点数低于 0 也结束。</li>
        </ul>
        <DialogClose data-variant="play">知道了</DialogClose>
      </DialogContent>
    </Dialog>
  )
}

function Settings({ length, onRestart }: { length: MatchLength; onRestart: (length: MatchLength) => void }) {
  const [picked, setPicked] = useState<MatchLength | null>(null)
  const [confirming, setConfirming] = useState(false)
  return (
    <Dialog
      onOpenChange={(open) => {
        if (open) return
        setPicked(null)
        setConfirming(false)
      }}
    >
      <DialogTrigger data-variant="text">设置</DialogTrigger>
      <DialogBackdrop />
      <DialogContent>
        <DialogTitle>比赛设置</DialogTitle>
        <DialogDescription>换比赛长度或重新开始，都会从东一局、每人 25,000 点重新打。</DialogDescription>
        <Field>
          <FieldLabel>比赛长度</FieldLabel>
          <SegmentedControl
            value={String(picked ?? length)}
            onValueChange={(value) => {
              const chosen = MATCH_LENGTHS.find((option) => String(option) === value)
              if (!chosen) return
              setPicked(chosen === length ? null : chosen)
              setConfirming(false)
            }}
          >
            {MATCH_LENGTHS.map((option) => (
              <SegmentedControlItem key={option} value={String(option)}>
                {LENGTH_NAMES[option]}
              </SegmentedControlItem>
            ))}
          </SegmentedControl>
          <FieldDescription>{LENGTH_NOTES[picked ?? length]}</FieldDescription>
        </Field>
        <Field>
          <FieldLabel>存档</FieldLabel>
          <FieldDescription>比赛和正在打的这一局都保存在这个浏览器里。下次打开从离开的地方接着打，牌不会重发。</FieldDescription>
          {picked !== null ? (
            <DialogClose data-variant="danger" action={() => onRestart(picked)}>
              确认：换成{LENGTH_NAMES[picked]}，从东一局重新开始
            </DialogClose>
          ) : confirming ? (
            <DialogClose data-variant="danger" action={() => onRestart(length)}>
              确认：每人回到 25,000 点，从东一局重新开始
            </DialogClose>
          ) : (
            <Button data-variant="outline" onClick={() => setConfirming(true)}>
              重新开始
            </Button>
          )}
        </Field>
        <DialogClose data-variant="play">好了</DialogClose>
      </DialogContent>
    </Dialog>
  )
}

/** The player's tiles. One tap lifts a tile, a second tap on it discards it; 打出 and 立直 act on the lifted one. */
function Hand({ game, legal, picked, onPick }: { game: MahjongState; legal: Action[]; picked: number | null; onPick: (tile: Tile) => void }) {
  const { hand } = game.players[HERO]
  const drawn = game.phase === "turn" && game.turn === HERO ? game.drawn : null
  const shown = [...hand.filter((tile) => tile.id !== drawn?.id).sort(byKind), ...(drawn ? [drawn] : [])]
  const discards = legal.flatMap((action) => (action.type === "discard" ? [action] : []))
  return (
    <ul data-slot="mj-hand" aria-label={`你的手牌：${shown.map((tile) => kindName(tile.kind)).join("、")}`}>
      {shown.map((tile) => (
        <li key={tile.id} data-drawn={tile.id === drawn?.id ? "" : undefined}>
          <button
            type="button"
            data-slot="mj-tile"
            aria-label={kindName(tile.kind)}
            aria-pressed={picked === tile.id}
            disabled={!discards.some((action) => action.tile === tile.id)}
            data-ready={discards.some((action) => action.tile === tile.id && action.riichi) ? "" : undefined}
            onClick={() => onPick(tile)}
          >
            <Face kind={tile.kind} />
          </button>
        </li>
      ))}
    </ul>
  )
}

function Mahjong({ onHome }: { onHome: () => void }) {
  const { game, legal, choose, deal, restart } = useMahjong()
  // The lifted tile belongs to one moment of the hand: once anything happens, nothing is lifted.
  const [lifted, setLifted] = useState<{ tile: number; at: number } | null>(null)
  const picked = lifted && lifted.at === game.actions.length ? lifted.tile : null
  const discards = legal.flatMap((action) => (action.type === "discard" ? [action] : []))
  const plain = discards.find((action) => action.tile === picked && !action.riichi)
  const riichi = discards.find((action) => action.tile === picked && action.riichi)
  const others = legal.filter((action) => action.type !== "discard")
  const lastDiscard = game.actions.reduce<number | null>((found, entry) => (entry.action.type === "discard" ? entry.action.tile : found), null)
  const last = game.result ? null : lastDiscard
  const long = game.players.some((player) => player.river.length > 18)
  const pick = (tile: Tile) => {
    if (picked === tile.id && plain) choose(plain)
    else setLifted({ tile: tile.id, at: game.actions.length })
  }

  return (
    <main data-slot="mahjong" data-over={game.result ? "" : undefined} data-long={long ? "" : undefined}>
      <header data-slot="mj-top">
        <Button data-variant="text" data-home="" aria-label="回到首页" onClick={onHome}>
          <span aria-hidden="true">‹</span>
          <span data-slot="mj-long"> 牌桌教练</span>
        </Button>
        <span data-slot="mj-round">
          <span data-slot="mj-long">日本麻将 · </span>
          {handName(game)} · {game.honba} 本场{game.sticks > 0 ? ` · 供托 ${game.sticks}` : ""}
        </span>
        <span data-slot="mj-dora" role="group" aria-label={`宝牌指示牌：${indicatorTiles(game).map((tile) => kindName(tile.kind)).join("、")}`}>
          <span>宝牌指示</span>
          {indicatorTiles(game).map((tile) => (
            <Shown key={tile.id} tile={tile} />
          ))}
        </span>
        <div data-slot="mj-menu">
          <Rules />
          <Settings length={game.length} onRestart={restart} />
        </div>
      </header>

      <div data-slot="mj-table">
        <div data-slot="mj-ring">
        <Walls game={game} />
        <div data-slot="mj-grid">
          {game.players.map((_, seat) => (
            <River key={SEAT_NAMES[seat]} game={game} seat={seat} last={last} />
          ))}
          <Centre game={game} />
          {OPPONENTS.map((seat) => (
            <Melds key={seat} game={game} seat={seat} />
          ))}
        </div>
        </div>
        <Result game={game} />
      </div>

      <footer data-slot="mj-controls" aria-label="你的操作">
        <p data-slot="mj-status" role="status">
          {statusLine(game, picked !== null && plain !== undefined)}
        </p>
        <div data-slot="mj-actions">
          {game.result ? (
            game.over ? (
              <Button data-variant="go" onClick={() => restart(game.length)}>
                再开一场
              </Button>
            ) : (
              <Button data-variant="go" onClick={deal}>
                下一局
              </Button>
            )
          ) : (
            <>
              {others.map((action) => (
                <Button key={actionLabel(action)} data-variant={action.type === "ron" || action.type === "tsumo" ? "go" : "call"} onClick={() => choose(action)}>
                  {actionLabel(action)}
                </Button>
              ))}
              {discards.some((action) => action.riichi) ? (
                <Button data-variant="call" disabled={!riichi} onClick={() => riichi && choose(riichi)}>
                  立直
                </Button>
              ) : null}
              {discards.length > 0 ? (
                <Button data-variant="go" disabled={!plain} onClick={() => plain && choose(plain)}>
                  打出
                </Button>
              ) : null}
            </>
          )}
        </div>
        <div data-slot="mj-mine">
          <Hand game={game} legal={legal} picked={picked} onPick={pick} />
          <Melds game={game} seat={HERO} />
        </div>
      </footer>
    </main>
  )
}

export { Mahjong }
