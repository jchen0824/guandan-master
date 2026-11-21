import { Accordion, AccordionHeader, AccordionItem, AccordionPanel, AccordionTrigger } from "@ui-sdk/react/accordion"
import { Button } from "@ui-sdk/react/button"
import { Dialog, DialogBackdrop, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@ui-sdk/react/dialog"
import { Field, FieldDescription, FieldLabel } from "@ui-sdk/react/field"
import { SegmentedControl, SegmentedControlItem } from "@ui-sdk/react/segmented-control"
import { useState } from "react"
import type { ReactNode } from "react"
import type { BotSkill } from "../../mahjong/bot"
import { SAFETY_NAMES, advise, shantenName } from "../../mahjong/coach"
import type { Advice, DiscardOption } from "../../mahjong/coach"
import { HERO, MATCH_LENGTHS, SEAT_NAMES, handName, indicatorTiles } from "../../mahjong/game"
import type { Action, MahjongState, MatchLength, Meld, Win } from "../../mahjong/game"
import { byKind, kindName, points } from "../../mahjong/tiles"
import type { Kind, Tile } from "../../mahjong/tiles"
import { useSaved } from "../useSaved"
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
          data-riichi={player.riichi > 0 ? "" : undefined}
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

/** Where each suit starts among the 34 kinds, for writing tiles in examples as "123m", "55p" or "4z1z". */
const SUIT_START: Record<string, number> = { m: 0, p: 9, s: 18, z: 27 }
function kindsOf(written: string): Kind[] {
  const kinds: Kind[] = []
  let digits = ""
  for (const char of written) {
    if (char in SUIT_START) {
      for (const digit of digits) kinds.push(SUIT_START[char] + Number(digit) - 1)
      digits = ""
    } else digits += char
  }
  return kinds
}

/** Tiles shown as an example in the rules: groups of tiles, each with an optional word under it. */
function Example({ groups }: { groups: [string, string?][] }) {
  return (
    <div data-slot="mj-example">
      {groups.map(([group, label]) => {
        const kinds = kindsOf(group)
        return (
          <span key={group}>
            <span role="img" aria-label={kinds.map(kindName).join("")}>
              {kinds.map((kind, at) => (
                // oxlint-disable-next-line react/no-array-index-key -- an example can show the same tile twice, and its tiles never move
                <span key={at} data-slot="mj-tile">
                  <Face kind={kind} />
                </span>
              ))}
            </span>
            {label ? <small>{label}</small> : null}
          </span>
        )
      })}
    </div>
  )
}

/** The rules, one section at a time. Each is short, with tiles to show what the words mean. */
const RULES: { title: string; body: ReactNode }[] = [
  {
    title: "和牌是什么样子",
    body: (
      <>
        <Example groups={[["123m"], ["456p"], ["789s"], ["555z"], ["55p"]]} />
        <p>四组是一二三万、四五六筒、七八九索、白白白，一对是五五筒。三张白是役，所以能和。</p>
      </>
    ),
  },
  {
    title: "顺子、刻子、对子",
    body: (
      <>
        <Example groups={[["345m", "顺子"], ["777s", "刻子"], ["55p", "对子"]]} />
        <p>顺子是同一种数牌连着的三张，字牌不能做顺子。刻子是三张一样的牌，四张一样叫杠子。对子是两张一样的牌。</p>
      </>
    ),
  },
  {
    title: "牌",
    body: (
      <>
        <Example groups={[["19m", "万"], ["19p", "筒"], ["19s", "索"], ["1234z", "风牌"], ["567z", "三元牌"]]} />
        <p>万、筒、索各有一到九。字牌是东南西北和白发中，白是一张空白的牌。每种四张，一共 136 张。</p>
      </>
    ),
  },
  {
    title: "吃、碰、杠",
    body: (
      <ul data-slot="rules-list">
        <li>吃：用上家打的牌凑顺子。只能吃上家的。</li>
        <li>碰：用任何一家打的牌凑刻子。</li>
        <li>杠：凑四张一样的，再从牌山后面补摸一张。</li>
        <li>吃、碰或杠了别人的牌，就不能再立直。</li>
      </ul>
    ),
  },
  {
    title: "役：和牌至少要有一个",
    body: (
      <>
        <ul data-slot="rules-list">
          <li>立直：没吃没碰、只差一张时宣布。</li>
          <li>门前清自摸：没吃没碰，自己摸到和牌。</li>
          <li>断幺九：手里没有一、九和字牌。</li>
          <li>役牌：白、发、中，或场风、自风的刻子。</li>
          <li>平和：没吃没碰，四组都是顺子，对子不是役牌，等两头的牌。</li>
        </ul>
        <p>宝牌只加番，不是役。</p>
      </>
    ),
  },
  {
    title: "立直",
    body: <p>没吃没碰、只差一张就和时可以立直：付 1,000 点，下一个和牌的人拿走。之后牌桌替你摸什么打什么。和了多一番。</p>,
  },
  {
    title: "自摸和荣和",
    body: (
      <ul data-slot="rules-list">
        <li>自摸：自己摸到和牌，另外三家一起付。</li>
        <li>荣和：别人打出你要的牌，打的人一个人付。</li>
      </ul>
    ),
  },
  {
    title: "振听：不能荣和的时候",
    body: (
      <>
        <Example groups={[["45m", "手里"], ["36m", "等这两张"], ["6m", "你打过"]]} />
        <p>你等的牌只要有一张在你自己的牌河里，就不能荣和，只能自摸。上面这手打过六万，别人打三万也不能和。</p>
        <ul data-slot="rules-list">
          <li>别人打出你要的牌你没和，到你下次摸牌前不能荣和。</li>
          <li>立直以后放过一次，这一局都不能荣和。</li>
        </ul>
      </>
    ),
  },
  {
    title: "宝牌",
    body: (
      <>
        <Example groups={[["5m6m", "五万 → 六万"], ["9m1m", "九万 → 一万"], ["4z1z", "北 → 东"], ["7z5z", "中 → 白"]]} />
        <p>牌山上翻开的是指示牌，它的下一张是宝牌。手里每有一张宝牌，多一番。</p>
      </>
    ),
  },
  {
    title: "流局和坐庄",
    body: (
      <ul data-slot="rules-list">
        <li>牌山摸完没人和就是流局。听牌的人从没听牌的人那里一共收 3,000 点。</li>
        <li>庄家和了，或流局时庄家听牌，就继续坐庄。不然由下家坐庄。</li>
      </ul>
    ),
  },
  {
    title: "一场比赛",
    body: <p>每人 25,000 点开始。东风战打完东场结束，半庄战打完南场结束。有人点数低于 0 就马上结束。</p>,
  },
]

function Rules() {
  return (
    <Dialog>
      <DialogTrigger data-variant="text">规则</DialogTrigger>
      <DialogBackdrop />
      <DialogContent initialFocus="content">
        <DialogTitle>日本麻将怎么打</DialogTitle>
        <DialogDescription>四个人轮流摸一张、打一张。凑成四组加一对，再有一个役，就能和牌。点一节看详细。</DialogDescription>
        <div data-slot="mj-rules">
          <Accordion defaultValue={[RULES[0].title]}>
            {RULES.map((rule) => (
              <AccordionItem key={rule.title} value={rule.title}>
                <AccordionHeader>
                  <AccordionTrigger>{rule.title}</AccordionTrigger>
                </AccordionHeader>
                <AccordionPanel>{rule.body}</AccordionPanel>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
        <DialogClose data-variant="play">知道了</DialogClose>
      </DialogContent>
    </Dialog>
  )
}

function Settings({ length, onRestart, skill, onSkill }: { length: MatchLength; onRestart: (length: MatchLength) => void; skill: BotSkill; onSkill: (skill: BotSkill) => void }) {
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
          <FieldLabel>电脑对手</FieldLabel>
          <SegmentedControl value={skill} onValueChange={(level) => level && onSkill(level as BotSkill)}>
            {LEVELS.map(([level, name]) => (
              <SegmentedControlItem key={level} value={level}>
                {name}
              </SegmentedControlItem>
            ))}
          </SegmentedControl>
          <FieldDescription>{LEVEL_NOTES[skill]} 从他们的下一步开始生效，教练的建议不受影响。</FieldDescription>
        </Field>
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

const LEVELS: [BotSkill, string][] = [
  ["novice", "新手"],
  ["basic", "普通"],
  ["advanced", "进阶"],
]
const LEVEL_NOTES: Record<BotSkill, string> = {
  novice: "只看离听牌还差几张，不数进张；能碰就碰，常常碰到没有役；从不防守。适合先熟悉规则。",
  basic: "按最快听牌的打法出牌，只碰役牌，听牌就立直，但别人立直了也不防守。",
  advanced: "和教练的打法一样：平时走最快的路，别人立直而自己离听牌还远时，改打安全牌。",
}

function Option({ option }: { option: DiscardOption }) {
  return (
    <li>
      <span data-slot="mj-tile">
        <Face kind={option.kind} />
      </span>
      <b>打{kindName(option.kind)}</b>
      {option.safety ? (
        <span data-slot="mj-safety" data-safety={option.safety}>
          {SAFETY_NAMES[option.safety]}
        </span>
      ) : null}
      <span>
        {shantenName(option.shanten)} · 进张 {option.useful.length} 种 {option.left} 张
      </span>
    </li>
  )
}

/** Every discard the coach weighed, and what its words mean. */
function Working({ options }: { options: DiscardOption[] }) {
  return (
    <Dialog>
      <DialogTrigger data-variant="text" data-how="">
        怎么算的
      </DialogTrigger>
      <DialogBackdrop />
      <DialogContent initialFocus="content">
        <DialogTitle>教练是怎么算的</DialogTitle>
        <DialogDescription>每一种能打的牌，打完以后手牌离听牌还差几张、有多少张牌能让它更近。排在最前的是教练的选择。</DialogDescription>
        <ul data-slot="mj-options" aria-label="每一种打法">
          {options.map((option) => (
            <Option key={option.kind} option={option} />
          ))}
        </ul>
        <ul data-slot="rules-list">
          <li>
            <b>向听</b>：离听牌还差几张。听牌是只差一张就和；一向听是再来一张有用的牌就听牌。
          </li>
          <li>
            <b>进张</b>：能让手牌更近一步的牌。种数越多、剩的张数越多，越容易摸到。已经看得见的牌不算在内。
          </li>
          <li>
            <b>现物</b>：立直的人自己打过的牌，或者他立直以后别人打出来他没和的牌。他不能荣和这些牌，绝对安全。
          </li>
          <li>
            <b>筋</b>：比如他打过四万，那么一万和七万不会是他两面听的牌，相对安全，但不是绝对。
          </li>
          <li>
            <b>熟字牌</b>：已经看见两张以上的字牌，别人很难用它和。<b>危险</b>：没有任何线索的牌。
          </li>
        </ul>
        <DialogClose data-variant="play">知道了</DialogClose>
      </DialogContent>
    </Dialog>
  )
}

/** The coach: what it would do now and why. Tests read its pick from `data-pick`. */
function Coach({ advice }: { advice: Advice | null }) {
  const discard = advice?.kind === "discard" ? advice : null
  return (
    <aside data-slot="mj-coach" data-stance={discard?.stance} data-pick={advice?.kind === "discard" ? kindName(advice.pick) : advice ? actionLabel(advice.pick) : undefined} aria-label="教练">
      <h2>
        教练{discard ? <span data-slot="mj-stance">{discard.stance === "defend" ? "守" : "攻"}</span> : null}
      </h2>
      <p data-slot="mj-say">{advice ? advice.reason : "等别人出牌。轮到你时，我会告诉你打哪张、为什么。"}</p>
      {discard ? (
        <>
          <ul data-slot="mj-options" aria-label="教练比较的三种打法">
            {discard.options.slice(0, 3).map((option) => (
              <Option key={option.kind} option={option} />
            ))}
          </ul>
          <Working options={discard.options} />
        </>
      ) : null}
    </aside>
  )
}

/** The player's tiles. One tap lifts a tile, a second tap on it discards it; 打出 and 立直 act on the lifted one. */
function Hand({ game, legal, picked, onPick, advice }: { game: MahjongState; legal: Action[]; picked: number | null; onPick: (tile: Tile) => void; advice: Advice | null }) {
  const safetyOf = (kind: Kind) => (advice?.kind === "discard" ? advice.options.find((option) => option.kind === kind)?.safety : undefined)
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
            data-coach={advice?.kind === "discard" && advice.pick === tile.kind ? "" : undefined}
            data-safety={safetyOf(tile.kind) ?? undefined}
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
  const { game, legal, skill, setSkill, choose, deal, restart } = useMahjong()
  const [coachOn, setCoachOn] = useSaved("guandan.mahjong.coach", true)
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
  const advice = coachOn && !game.result ? advise(game) : null
  const pick = (tile: Tile) => {
    if (picked === tile.id && plain) choose(plain)
    else setLifted({ tile: tile.id, at: game.actions.length })
  }

  return (
    <main data-slot="mahjong" data-over={game.result ? "" : undefined} data-long={long ? "" : undefined} data-coach-on={coachOn ? "" : undefined}>
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
          <Button data-variant="coach" aria-pressed={coachOn} onClick={() => setCoachOn(!coachOn)}>
            教练
          </Button>
          <Rules />
          <Settings length={game.length} onRestart={restart} skill={skill} onSkill={setSkill} />
        </div>
      </header>

      {coachOn ? <Coach advice={advice} /> : null}
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
          <Hand game={game} legal={legal} picked={picked} onPick={pick} advice={advice} />
          <Melds game={game} seat={HERO} />
        </div>
      </footer>
    </main>
  )
}

export { Mahjong }
