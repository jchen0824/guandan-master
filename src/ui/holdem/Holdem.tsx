import { Button } from "@ui-sdk/react/button"
import { Dialog, DialogBackdrop, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@ui-sdk/react/dialog"
import { Field, FieldDescription, FieldLabel } from "@ui-sdk/react/field"
import { SegmentedControl, SegmentedControlItem } from "@ui-sdk/react/segmented-control"
import { useState } from "react"
import type { BotSkill } from "../../holdem/bot"
import { cardName, chips } from "../../holdem/cards"
import type { Advice } from "../../holdem/coach"
import { HERO, SEAT_NAMES, describeAction, lastWhere, legalActions, positionName } from "../../holdem/game"
import type { Action, HoldemState, Street } from "../../holdem/game"
import { CATEGORIES, categoryName, describeHand, evaluate } from "../../holdem/hands"
import type { HandCategory } from "../../holdem/hands"
import { place } from "../place"
import { useSaved } from "../useSaved"
import { PlayingCard } from "./PlayingCard"
import { nearestStep, raiseLabel, raiseSizes } from "./sizes"
import { biggestWinner, resultLine } from "./summary"
import { useHoldem } from "./useHoldem"
import type { Decision } from "./useHoldem"

const STREETS: [Street, string][] = [
  ["preflop", "翻牌前"],
  ["flop", "翻牌"],
  ["turn", "转牌"],
  ["river", "河牌"],
  ["showdown", "摊牌"],
]
const STREET_NAMES = Object.fromEntries(STREETS)
const OPPONENTS = [1, 2, 3, 4, 5]
const BOARD_SLOTS = ["flop-1", "flop-2", "flop-3", "turn", "river"]
const percent = (value: number) => `${Math.round(value * 100)}%`

/** What a seat's label says under its name: its last move on this street and the chips it has left. Small screens drop the second half. */
function SeatNote({ game, seat }: { game: HoldemState; seat: number }) {
  const { folded, allIn, stack } = game.seats[seat]
  const shown = game.result?.shown.find((entry) => entry.seat === seat)
  const last = lastWhere(game.log, (entry) => entry.seat === seat && entry.street === game.street)
  if (shown) {
    return (
      <span data-slot="he-note">
        <span data-slot="he-long">{describeHand(shown.value)}</span>
        <span data-slot="he-short">{categoryName(shown.value.category)}</span>
      </span>
    )
  }
  if (allIn && !folded) return <span data-slot="he-note">全下</span>
  if (!folded && (!last || last.kind === "blind")) return <span data-slot="he-note">筹码 {chips(stack)}</span>
  return (
    <span data-slot="he-note">
      {folded ? "已弃牌" : last ? describeAction(last) : ""}
      <span data-slot="he-long">
        {folded ? " · " : " · 剩 "}
        {chips(stack)}
      </span>
    </span>
  )
}

/** The dealer button, worn as a badge on the label of the seat that has it. */
function DealerMark({ seat }: { seat: number }) {
  return (
    <span data-slot="he-dealer" role="img" aria-label={`庄家按钮在${SEAT_NAMES[seat]}这里`}>
      庄
    </span>
  )
}

type Mark = (id: number) => "used" | "unused" | undefined

function Seat({ game, seat, mark }: { game: HoldemState; seat: number; mark: Mark }) {
  const state = game.seats[seat]
  const shown = game.result?.shown.some((entry) => entry.seat === seat)
  return (
    <section
      data-slot="he-seat"
      data-seat={seat}
      data-folded={state.folded ? "" : undefined}
      data-active={game.toAct === seat ? "" : undefined}
      data-shown={shown ? "" : undefined}
      aria-label={`${SEAT_NAMES[seat]}，${positionName(game, seat)}`}
    >
      <div data-slot="he-chip">
        <span data-slot="he-avatar" aria-hidden="true">
          {SEAT_NAMES[seat]}
        </span>
        <span data-slot="he-who">
          <b>{SEAT_NAMES[seat]}</b> <span>{positionName(game, seat)}</span>
        </span>
        <SeatNote game={game} seat={seat} />
        {game.button === seat ? <DealerMark seat={seat} /> : null}
      </div>
      {state.bet > 0 && !game.result ? <span data-slot="he-bet">{chips(state.bet)}</span> : null}
      {shown ? (
        <span data-slot="he-shown">
          {state.hole.map((card) => (
            <PlayingCard key={card.id} card={card} mark={seat === biggestWinner(game) ? mark(card.id) : undefined} />
          ))}
        </span>
      ) : null}
    </section>
  )
}

function Ranks({ made, drawing, game }: { made: HandCategory | null; drawing: boolean; game: HoldemState }) {
  const theirs = new Map(game.result?.shown.filter((entry) => entry.seat !== HERO).map((entry) => [entry.value.category, SEAT_NAMES[entry.seat]]))
  return (
    <aside data-slot="he-ranks" aria-label="牌型大小">
      <h2>牌型从大到小</h2>
      <ol>
        {CATEGORIES.map((category) => (
          <li
            key={category}
            data-mine={category === made ? "" : undefined}
            data-theirs={theirs.has(category) && category !== made ? "" : undefined}
            data-draw={drawing && category === "flush" && made !== "flush" ? "" : undefined}
          >
            <span>{categoryName(category)}</span>
            {category === made ? <span>你现在</span> : theirs.has(category) ? <span>{theirs.get(category)}</span> : null}
          </li>
        ))}
      </ol>
    </aside>
  )
}

const VERDICTS: [Decision["grade"]["verdict"], string][] = [
  ["good", "好"],
  ["ok", "可以"],
  ["poor", "欠妥"],
]

/** 好 3 · 可以 1: how many of the hand's decisions got each grade. */
function tally(decisions: Decision[]): string {
  return VERDICTS.map(([verdict, label]) => [label, decisions.filter((decision) => decision.grade.verdict === verdict).length] as const)
    .filter(([, count]) => count > 0)
    .map(([label, count]) => `${label} ${count}`)
    .join(" · ")
}

function Review({ decisions }: { decisions: Decision[] }) {
  if (decisions.length === 0) return <p data-slot="he-review">这一手你没有需要做决定的地方。</p>
  return (
    <ol data-slot="he-review">
      {decisions.map((decision, index) => (
        // oxlint-disable-next-line react/no-array-index-key -- a hand's decisions are only ever appended, never reordered
        <li key={index} data-verdict={decision.grade.verdict}>
          <p data-slot="he-decision">
            <span>{STREET_NAMES[decision.street]}</span>
            <b>{decision.did}</b>
            <span data-slot="he-grade">{decision.grade.label}</span>
          </p>
          <p>{decision.grade.note}</p>
        </li>
      ))}
    </ol>
  )
}

/** The same review as the coach panel shows on a wide screen, for screens where the panel is only a bar. */
function ReviewDialog({ decisions }: { decisions: Decision[] }) {
  return (
    <Dialog>
      <DialogTrigger data-variant="fold" data-review="">
        看复盘
      </DialogTrigger>
      <DialogBackdrop />
      <DialogContent>
        <DialogTitle>这一手的复盘</DialogTitle>
        <DialogDescription>你做了 {decisions.length} 个决定。教练在每一步会怎么打，写在下面。</DialogDescription>
        <Review decisions={decisions} />
        <DialogClose data-variant="play">知道了</DialogClose>
      </DialogContent>
    </Dialog>
  )
}

function Coach({ on, game, advice, decisions, outcome }: { on: boolean; game: HoldemState; advice: Advice | null; decisions: Decision[]; outcome: string | null }) {
  const waiting = game.toAct === null || game.toAct === HERO ? "" : `等${SEAT_NAMES[game.toAct]}行动…`
  // With the coach off, one plain line of what is happening at the table stays, as on the 掼蛋 table.
  if (!on) {
    return (
      <aside data-slot="he-coach" data-quiet="" aria-label="牌桌动态">
        <p role="status">{game.result ? outcome : (advice?.situation ?? waiting)}</p>
      </aside>
    )
  }
  if (game.result) {
    return (
      <aside data-slot="he-coach" aria-label="教练">
        <p data-slot="he-outcome">{outcome}</p>
        <h2>教练 · 这一手你做了 {decisions.length} 个决定</h2>
        {decisions.length > 0 ? <p data-slot="he-tally">{tally(decisions)}</p> : null}
        <Review decisions={decisions} />
      </aside>
    )
  }
  if (!advice) {
    return (
      <aside data-slot="he-coach" aria-label="教练">
        <h2>教练 · {STREET_NAMES[game.street]}</h2>
        <p role="status">{waiting}</p>
      </aside>
    )
  }
  return (
    <aside data-slot="he-coach" data-advice={advice.action.kind} aria-label="教练">
      <h2>教练 · {STREET_NAMES[game.street]}</h2>
      {advice.explain.length > 0 ? <WorkingDialog advice={advice} /> : null}
      <Working advice={advice} live />
    </aside>
  )
}

/** The coach's numbers and working. `live` announces the situation to screen readers; only the panel does. */
function Working({ advice, live = false }: { advice: Advice; live?: boolean }) {
  return (
    <>
      <p role={live ? "status" : undefined} data-slot="he-situation">
        {advice.situation}
        {advice.explain.length === 0 && advice.drawText ? `你${advice.drawText}。` : ""}
      </p>
      <dl data-slot="he-odds">
        {advice.need === null ? null : (
          <div>
            <dt>跟注要有的胜率</dt>
            <dd>{percent(advice.need)}</dd>
            {/* oxlint-disable-next-line react/forbid-dom-props -- sets only the custom property that sizes this bar */}
            <span aria-hidden="true" data-slot="he-bar" data-kind="need" style={place({ share: advice.need })} />
          </div>
        )}
        <div>
          <dt>你的胜率，大约</dt>
          <dd>{percent(advice.have)}</dd>
          {/* oxlint-disable-next-line react/forbid-dom-props -- sets only the custom property that sizes this bar */}
          <span aria-hidden="true" data-slot="he-bar" data-kind="have" style={place({ share: advice.have })} />
        </div>
      </dl>
      {advice.explain.length > 0 ? (
        <dl data-slot="he-explain">
          {advice.explain.map((line) => (
            <div key={line.key} data-line={line.key}>
              <dt>{line.label}</dt>
              <dd>{line.text}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <p data-slot="he-why">{advice.reason}</p>
      {advice.reminder ? (
        <div data-slot="he-remind">
          <h3>提醒</h3>
          <p>{advice.reminder}</p>
        </div>
      ) : null}
    </>
  )
}

/** On screens where the coach is only a bar, the full working opens here. */
function WorkingDialog({ advice }: { advice: Advice }) {
  return (
    <Dialog>
      <DialogTrigger data-variant="text" data-working="">
        怎么算的
      </DialogTrigger>
      <DialogBackdrop />
      <DialogContent>
        <DialogTitle>教练是怎么算的</DialogTitle>
        <div data-slot="he-working">
          <Working advice={advice} />
        </div>
        <DialogClose data-variant="play">知道了</DialogClose>
      </DialogContent>
    </Dialog>
  )
}

/** The buttons for the player's turn. It is mounted afresh for each decision, so the raise size starts from a sensible default. */
/** `coached` starts the raise size at the coach's amount; without the coach it starts at two thirds of the pot. */
function Actions({ game, advice, coached, onChoose }: { game: HoldemState; advice: Advice; coached: boolean; onChoose: (action: Action) => void }) {
  const legal = legalActions(game)
  const options = raiseSizes(game)
  const [size, setSize] = useState(() => ({
    name: "",
    to: options === null ? 0 : coached && advice.action.kind === "raise" ? nearestStep(options.steps, advice.action.to) : options.ofPot(2 / 3),
  }))
  const amount = size.to
  const raising = game.currentBet > 0 ? "加注到" : "下注"
  return (
    <div data-slot="he-actions">
      {options && options.presets.length > 0 ? (
        <>
          <div data-slot="he-sizes" role="group" aria-label={`${raising}多少`}>
            {options.presets.map(([name, to]) => (
              <Button key={name} data-variant="size" aria-pressed={size.name === name} onClick={() => setSize({ name, to })}>
                <span>{name}</span>
                <b>{chips(to)}</b>
              </Button>
            ))}
          </div>
          <label data-slot="he-slider">
            <span>{raising}</span>
            {/* The slider moves through the allowed amounts by position, so both ends are exact. */}
            <input
              type="range"
              min={0}
              max={options.steps.length - 1}
              step={1}
              value={options.steps.indexOf(nearestStep(options.steps, amount))}
              aria-valuetext={chips(amount)}
              onChange={(event) => setSize({ name: "", to: options.steps[Number(event.target.value)] })}
            />
          </label>
        </>
      ) : null}
      <div data-slot="he-buttons">
        <Button data-variant="fold" onClick={() => onChoose({ kind: "fold" })}>
          弃牌
        </Button>
        {legal.canCheck ? (
          <Button data-variant="call" onClick={() => onChoose({ kind: "check" })}>
            过牌
          </Button>
        ) : (
          <Button data-variant="call" onClick={() => onChoose({ kind: "call" })}>
            跟注 {chips(legal.callAmount)}
          </Button>
        )}
        {options ? (
          <Button data-variant="raise" onClick={() => onChoose({ kind: "raise", to: amount })}>
            {raiseLabel(game, amount, options.most)}
          </Button>
        ) : null}
      </div>
    </div>
  )
}

function Rules() {
  return (
    <Dialog>
      <DialogTrigger data-variant="text">规则</DialogTrigger>
      <DialogBackdrop />
      <DialogContent>
        <DialogTitle>德州扑克怎么打</DialogTitle>
        <DialogDescription>每人两张自己的牌，桌上五张公共牌。用这七张里最好的五张比大小。</DialogDescription>
        <ul data-slot="rules-list">
          <li>一手牌有四轮下注：翻牌前、翻牌（发三张公共牌）、转牌（第四张）、河牌（第五张）。</li>
          <li>轮到你时可以弃牌、过牌或跟注、下注或加注。没人下注才能过牌。</li>
          <li>加注至少要和上一次加的一样多。筹码不够时可以全下。</li>
          <li>只剩一个人没弃牌，他直接赢下底池；否则河牌之后摊牌比大小。</li>
          <li>牌型从大到小：同花顺、四条、葫芦、同花、顺子、三条、两对、一对、高牌。</li>
          <li>这里只用练习筹码。输光了下一手会补满。</li>
        </ul>
        <h3 data-slot="rules-heading">自己估胜率</h3>
        <ul data-slot="rules-list" aria-label="自己估胜率">
          <li>
            <b>有效牌</b>：再发一张就能让你多半能赢的牌。比如手里 A♥ 9♥，公共牌 K♣ Q♠ 3♥：另外三张 A 来一张就是顶对 A，有效牌就是 3 张。来一张 9 只成中对，不算。
          </li>
          <li>
            <b>二四法则</b>：你看不到的牌有 47 张，每发一张，某一张牌出现的机会约 2%。翻牌后还要发转牌和河牌两张，每张有效牌约 4%，所以中的机会约等于有效牌数 × 4；转牌后只剩河牌一张，就 × 2。上面的例子：3 × 4 ≈ 12%。
          </li>
          <li>
            <b>跟注要有的胜率</b>：跟注的钱 ÷ 跟注后底池里的全部筹码。比如花 20 去赢 100，要有 20% 的胜率才不亏。估出来的胜率比它高，跟注就划算。
          </li>
        </ul>
        <DialogClose data-variant="play">知道了</DialogClose>
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
  novice: "什么牌都想看一眼，爱跟注，很少加注，从不诈唬。适合先练看牌力和底池赔率。",
  basic: "按牌力和位置打，会算底池赔率，但算得粗，有时跟注太松，偶尔诈唬。",
  advanced: "好牌主动加注，后位会偷盲，只在价钱合适时跟注，牌稍好就下注拿价值。",
}

function Settings({ skill, onSkill, onRestart }: { skill: BotSkill; onSkill: (skill: BotSkill) => void; onRestart: () => void }) {
  const [confirming, setConfirming] = useState(false)
  return (
    <Dialog onOpenChange={(open) => !open && setConfirming(false)}>
      <DialogTrigger data-variant="text">设置</DialogTrigger>
      <DialogBackdrop />
      <DialogContent>
        <DialogTitle>电脑玩家水平</DialogTitle>
        <DialogDescription>五位电脑对手都按这个水平打，从他们的下一步开始生效。教练的建议不受影响。</DialogDescription>
        <Field>
          <FieldLabel>五位对手</FieldLabel>
          <SegmentedControl value={skill} onValueChange={(next) => next && onSkill(next as BotSkill)}>
            {LEVELS.map(([level, name]) => (
              <SegmentedControlItem key={level} value={level}>
                {name}
              </SegmentedControlItem>
            ))}
          </SegmentedControl>
          <FieldDescription>{LEVEL_NOTES[skill]}</FieldDescription>
        </Field>
        <Field>
          <FieldLabel>存档</FieldLabel>
          <FieldDescription>每打完一手，六个人的筹码都会保存在这个浏览器里，下次打开从下一手接着打。没打完的一手不保存。</FieldDescription>
          {confirming ? (
            <DialogClose data-variant="danger" action={onRestart}>
              确认：所有人回到 2,000 筹码，从第 1 手开始
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

/** The Texas Hold'em table: six seats, the board, the coach, and the player's cards and buttons. */
function Holdem({ onHome }: { onHome: () => void }) {
  const { game, advice, decisions, notice, skill, setSkill, choose, deal, restart } = useHoldem()
  const [coachOn, setCoachOn] = useSaved("guandan.holdem.coach", true)
  const hero = game.seats[HERO]
  const over = game.result !== null
  const result = resultLine(game)
  const best = biggestWinner(game)
  const marked = best === null ? null : game.result?.shown.find((entry) => entry.seat === best)?.value.cards.map((card) => card.id)
  const mark: Mark = (id) => (marked ? (marked.includes(id) ? "used" : "unused") : undefined)
  const holding = !hero.folded && (game.board.length >= 3 || hero.hole[0].rank === hero.hole[1].rank)
  const made = holding ? evaluate([...hero.hole, ...game.board]).category : null
  const mine = hero.hole.slice().sort((a, b) => b.rank - a.rank)
  const reached = STREETS.findIndex(([street]) => street === game.street)

  return (
    <main data-slot="holdem" data-over={over ? "" : undefined} data-coach-off={coachOn ? undefined : ""}>
      <header data-slot="he-top">
        <Button data-variant="text" data-home="" onClick={onHome}>
          <span aria-hidden="true">‹</span> 牌桌教练
        </Button>
        <span data-slot="he-hand">
          <span data-slot="he-long">德州扑克 · </span>第 {game.handNumber} 手 · <span data-slot="he-long">盲注 </span>10/20
        </span>
        <ol data-slot="he-streets" aria-label="这一手打到哪一步">
          {STREETS.filter(([street]) => street !== "showdown" || game.street === "showdown").map(([street, name], index) => (
            <li key={street} aria-current={index === reached ? "step" : undefined}>
              {name}
            </li>
          ))}
        </ol>
        <div data-slot="he-menu">
          <Button data-variant="coach" aria-pressed={coachOn} onClick={() => setCoachOn(!coachOn)}>
            教练
          </Button>
          <Rules />
          <Settings skill={skill} onSkill={setSkill} onRestart={restart} />
        </div>
      </header>

      <div data-slot="he-table">
        <div data-slot="he-stage">
          <span data-slot="he-felt" aria-hidden="true" />
          {OPPONENTS.map((seat) => (
            <Seat key={seat} game={game} seat={seat} mark={mark} />
          ))}
          <p data-slot="he-pot">
            底池 <b>{chips(game.pot)}</b>
          </p>
          <ul data-slot="he-board" aria-label={game.board.length > 0 ? `公共牌：${game.board.map(cardName).join("、")}` : "公共牌还没发"}>
            {BOARD_SLOTS.map((slot, index) => (
              <li key={slot}>{game.board[index] ? <PlayingCard card={game.board[index]} mark={mark(game.board[index].id)} /> : <span data-slot="card-gap" />}</li>
            ))}
          </ul>
          {result ? (
            <p data-slot="he-banner" role="status">
              <b>{result.title}</b>
              <span>{result.line}</span>
            </p>
          ) : null}
        </div>
        <Ranks game={game} made={made} drawing={advice?.drawText?.includes("同花") ?? false} />
        <Coach on={coachOn} game={game} advice={advice} decisions={decisions} outcome={result?.line ?? null} />
      </div>

      <footer data-slot="he-controls" aria-label="你的操作">
        <div data-slot="he-me" data-active={game.toAct === HERO ? "" : undefined}>
          <span data-slot="he-avatar" aria-hidden="true">
            你
          </span>
          <span data-slot="he-who">
            <b>{game.toAct === HERO ? "轮到你" : hero.folded ? "你已弃牌" : "你"}</b> <span>{positionName(game, HERO)}</span>
          </span>
          <span data-slot="he-note">筹码 {chips(hero.stack)}</span>
          {hero.total > 0 && !over ? <span data-slot="he-in">本手已下 {chips(hero.total)}</span> : null}
          {game.button === HERO ? <DealerMark seat={HERO} /> : null}
        </div>
        {hero.bet > 0 && !over ? (
          <span data-slot="he-bet" data-seat={HERO}>
            {chips(hero.bet)}
          </span>
        ) : null}
        <ul data-slot="he-hole" aria-label={`你的手牌：${mine.map(cardName).join("、")}`} data-folded={hero.folded ? "" : undefined}>
          {mine.map((card) => (
            <li key={card.id}>
              <PlayingCard card={card} mark={mark(card.id)} />
            </li>
          ))}
        </ul>
        {notice ? (
          <p data-slot="he-notice" role="alert">
            {notice}
          </p>
        ) : null}
        {over ? (
          <div data-slot="he-actions">
            <div data-slot="he-buttons">
              {coachOn ? <ReviewDialog decisions={decisions} /> : null}
              <Button data-variant="raise" onClick={deal}>
                下一手
              </Button>
            </div>
          </div>
        ) : advice ? (
          <Actions key={game.log.length} game={game} advice={advice} coached={coachOn} onChoose={choose} />
        ) : (
          <div data-slot="he-actions" />
        )}
      </footer>
    </main>
  )
}

export { Holdem }
