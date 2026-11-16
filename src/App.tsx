import { Button } from "@ui-sdk/react/button"
import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@ui-sdk/react/dialog"
import { Toggle, ToggleGroup } from "@ui-sdk/react/toggle"
import { useRef, useState } from "react"
import type { PointerEvent as ReactPointerEvent } from "react"
import { rankLabel, sortHand } from "./engine/cards"
import type { Suit } from "./engine/cards"
import { describeCombo } from "./engine/combos"
import type { GameState, PlayRecord } from "./engine/game"
import { CardFace, CardRow } from "./ui/CardFace"
import { CardFace3D } from "./ui/CardFace3D"
import { cardAttributes, cardLabel } from "./ui/cardAttributes"
import { Coach } from "./ui/Coach"
import { describeSituation, turnNote } from "./ui/situation"
import { Player } from "./ui/Player"
import { PlayLog } from "./ui/PlayLog"
import { BombMoment } from "./ui/BombMoment"
import { ScorePanel } from "./ui/ScorePanel"
import { Table3D } from "./ui/Table3D"
import { Tracker } from "./ui/Tracker"
import { tributeLines } from "./ui/tribute"
import { LogDialog, ResumeDialog, RulesDialog, SettingsDialog } from "./ui/Dialogs"
import { buildColumns } from "./ui/columns"
import { HUMAN, PLACE_NAMES, SEAT_NAMES, SIDES, TEAM_NAMES } from "./ui/names"
import { useGame } from "./ui/useGame"
import { useView } from "./ui/view"
import { ViewSwitch } from "./ui/ViewSwitch"

function PlayZone({ game, record, seat }: { game: GameState; record: PlayRecord | null; seat: number }) {
  return (
    <div data-slot="play-zone" data-side={SIDES[seat]}>
      {record === null ? null : record.combo === null ? (
        <span data-slot="pass-mark">不出</span>
      ) : (
        <CardRow
          cards={record.combo.cards}
          level={game.level}
          label={`${SEAT_NAMES[seat]}出的牌：${describeCombo(record.combo, game.level)}`}
        />
      )}
    </div>
  )
}

function TributeLine({ game }: { game: GameState }) {
  if (game.log.length > 3) return null
  const lines = tributeLines(game)
  return lines.length > 0 ? <span data-slot="tribute">{lines.join("")}</span> : null
}

function Review({ game }: { game: GameState }) {
  return (
    <div data-slot="review">
      <h3>四家起手牌</h3>
      {game.dealt.map((cards, seat) => (
        <div key={SEAT_NAMES[seat]} data-slot="review-hand">
          <strong>{SEAT_NAMES[seat]}</strong>
          <CardRow cards={sortHand(cards, game.level)} level={game.level} label={`${SEAT_NAMES[seat]}的起手牌`} />
        </div>
      ))}
      <PlayLog game={game} />
    </div>
  )
}

function ResultDialog({
  game,
  open,
  onOpenChange,
  onNext,
  saveFailed,
}: {
  game: GameState
  open: boolean
  onOpenChange: (open: boolean) => void
  onNext: () => void
  saveFailed: boolean
}) {
  const result = game.result
  return (
    <Dialog open={open && result !== null} onOpenChange={onOpenChange}>
      <DialogBackdrop />
      <DialogContent>
        {result ? (
          <>
            <DialogTitle>
              {result.matchWinner !== null
                ? `${TEAM_NAMES[result.matchWinner]}过A，赢得整场比赛！`
                : `第 ${game.handNumber} 局结束：${TEAM_NAMES[result.winnerTeam]}获胜`}
            </DialogTitle>
            <DialogDescription>
              名次：{result.order.map((seat, i) => `${PLACE_NAMES[i]} ${SEAT_NAMES[seat]}`).join("，")}。
              {result.matchWinner === null && result.levelsAfter[result.winnerTeam] !== result.levelsBefore[result.winnerTeam]
                ? `${TEAM_NAMES[result.winnerTeam]}升 ${result.gain} 级。`
                : ""}
            </DialogDescription>
            <dl data-slot="levels">
              {TEAM_NAMES.map((name, team) => (
                <div key={name}>
                  <dt>{name}</dt>
                  <dd>
                    {rankLabel(result.levelsBefore[team])} → {rankLabel(result.levelsAfter[team])}
                  </dd>
                </div>
              ))}
            </dl>
            {result.notes.map((note) => (
              <p key={note} data-slot="result-note">
                {note}
              </p>
            ))}
            <div data-slot="dialog-actions">
              <Button data-variant="play" onClick={onNext}>
                {result.matchWinner !== null ? "再来一场" : "下一局"}
              </Button>
              <DialogClose data-variant="outline">再看看牌桌</DialogClose>
            </div>
            {result.matchWinner === null ? (
              <p data-slot="save-status" data-failed={saveFailed ? "" : undefined} role="status">
                {saveFailed
                  ? "进度没能保存：这个浏览器禁止了本地存储。"
                  : "进度已保存在这个浏览器里，关掉页面后下次可以接着打。"}
              </p>
            ) : null}
            <Review game={game} />
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

const SUITS: [Suit, string, string][] = [
  ["S", "♠", "只看黑桃"],
  ["H", "♥", "只看红桃"],
  ["C", "♣", "只看梅花"],
  ["D", "♦", "只看方块"],
]

function useSaved(key: string, fallback: boolean): [boolean, (value: boolean) => void] {
  const [value, setValue] = useState(() => {
    try {
      const saved = localStorage.getItem(key)
      return saved === null ? fallback : saved === "1"
    } catch {
      return fallback
    }
  })
  const save = (next: boolean) => {
    setValue(next)
    try {
      localStorage.setItem(key, next ? "1" : "0")
    } catch {
      return
    }
  }
  return [value, save]
}

function cardIdAt(x: number, y: number): number | null {
  const card = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-card-id]")
  return card ? Number(card.dataset.cardId) : null
}

/** Sliding a finger or the mouse across cards selects (or deselects) each one it crosses. */
function useSwipeSelect(selected: number[], selectCard: (id: number, on: boolean) => void) {
  const swipe = useRef<{ start: number; on: boolean; seen: Set<number>; moved: boolean } | null>(null)
  const swallowClick = useRef(false)
  const apply = (id: number) => {
    const current = swipe.current
    if (!current || current.seen.has(id)) return
    current.seen.add(id)
    selectCard(id, current.on)
  }
  return {
    onPointerDown: (event: ReactPointerEvent) => {
      swallowClick.current = false
      const id = cardIdAt(event.clientX, event.clientY)
      swipe.current = id === null ? null : { start: id, on: !selected.includes(id), seen: new Set(), moved: false }
    },
    onPointerMove: (event: ReactPointerEvent) => {
      const current = swipe.current
      if (!current) return
      const id = cardIdAt(event.clientX, event.clientY)
      if (id === null || (!current.moved && id === current.start)) return
      if (!current.moved) {
        current.moved = true
        swallowClick.current = true
        apply(current.start)
      }
      apply(id)
    },
    onPointerUp: () => {
      swipe.current = null
      setTimeout(() => {
        swallowClick.current = false
      }, 0)
    },
    onPointerCancel: () => {
      swipe.current = null
      swallowClick.current = false
    },
    onClickCapture: (event: { preventDefault: () => void; stopPropagation: () => void }) => {
      if (!swallowClick.current) return
      swallowClick.current = false
      event.preventDefault()
      event.stopPropagation()
    },
  }
}

function App() {
  const g = useGame()
  const swipe = useSwipeSelect(g.selected, g.selectCard)
  const [coachOn, setCoachOn] = useSaved("guandan.coach", true)
  const [trackerOn, setTrackerOn] = useSaved("guandan.tracker", true)
  const [coachOpen, setCoachOpen] = useState(false)
  const [view, setView] = useView()
  const three = view === "3d"
  const pressCoach = () => {
    if (!coachOn) return setCoachOn(true)
    // The 3D table has no docked panel, so the full coach always opens as a drawer there.
    if (three || window.matchMedia("(max-width: 1000px)").matches) return setCoachOpen(true)
    setCoachOn(false)
  }
  const hideCoach = () => {
    setCoachOn(false)
    setCoachOpen(false)
  }
  const [suit, setSuit] = useState<Suit[]>([])
  const { game } = g
  const columns = buildColumns(g.hand, g.groups, game.level)
  const myPlace = game.finished.indexOf(HUMAN)
  const situation = describeSituation(game, g.myTurn, g.mustReturn)
  const acting = g.myTurn || g.mustReturn
  const over = game.phase === "handOver" || game.phase === "matchOver"
  // The result waits until the player asks for it, so the last plays stay in view. A new hand closes it.
  const [resultFor, setResultFor] = useState<GameState | null>(null)
  const bubble = (
    <div data-slot="bubble">
      <p role="status">
        {coachOn ? <strong>教练</strong> : null}
        {coachOn ? situation.short : situation.plain} <TributeLine game={game} />
      </p>
      {g.notice ? (
        <p data-slot="notice" data-kind={g.notice.kind} role={g.notice.kind === "error" ? "alert" : "status"}>
          {g.notice.kind === "hint" ? "提示：" : ""}
          {g.notice.text}
        </p>
      ) : null}
    </div>
  )

  return (
    <main
      data-slot="app"
      data-view={view}
      data-coach-on={coachOn ? "" : undefined}
      data-coach-open={coachOn && coachOpen ? "" : undefined}
    >
      <div data-slot="board">
        <header data-slot="topbar">
          {three ? (
            <div data-slot="brand">
              <strong>掼蛋教练</strong>
              <span>第 {game.handNumber} 局</span>
            </div>
          ) : null}
          <div data-slot="scores">
            <span data-slot="level-badge">
              <span data-slot="badge-long">本局</span>打 <b>{rankLabel(game.level)}</b>
            </span>
            <span data-slot="score">
              {TEAM_NAMES[0]} <b>{rankLabel(game.levels[0])}</b>
            </span>
            <span data-slot="score">
              {TEAM_NAMES[1]} <b>{rankLabel(game.levels[1])}</b>
            </span>
          </div>
          {three ? (
            <div data-slot="top-middle">{trackerOn ? <Tracker game={game} /> : null}</div>
          ) : (
            <section data-slot="seat-top" aria-label={SEAT_NAMES[2]}>
              <Player game={game} seat={2} />
              <PlayZone game={game} record={g.table[2]} seat={2} />
            </section>
          )}
          <div data-slot="menu">
            <span data-slot="round">
              第 {game.handNumber} 局 · 逢人配 <b>♥{rankLabel(game.level)}</b>
            </span>
            <ViewSwitch view={view} onChange={setView} />
            <RulesDialog />
            <LogDialog game={game} />
            <SettingsDialog
              skills={g.skills}
              onChange={g.setSkills}
              onStartOver={g.startOver}
              view={view}
              onViewChange={setView}
            />
            <Button data-variant="coach" aria-pressed={coachOn} onClick={pressCoach}>
              {coachOn ? null : <span data-slot="badge-long">显示</span>}教练
            </Button>
          </div>
        </header>

        <div data-slot="table">
          {three ? (
            <>
              <Table3D game={game} table={g.table} />
              <ScorePanel game={game} />
              <BombMoment game={game} table={g.table} />
              {bubble}
            </>
          ) : (
            <>
              <section data-slot="seat-left" aria-label={SEAT_NAMES[3]}>
                <Player game={game} seat={3} />
                <PlayZone game={game} record={g.table[3]} seat={3} />
              </section>
              <div data-slot="center">
                {trackerOn ? <Tracker game={game} /> : null}
                {bubble}
              </div>
              <section data-slot="seat-right" aria-label={SEAT_NAMES[1]}>
                <PlayZone game={game} record={g.table[1]} seat={1} />
                <Player game={game} seat={1} />
              </section>
            </>
          )}
        </div>

        <section data-slot="controls" aria-label="你的操作">
          {three ? <p data-slot="turn-note">{turnNote(game, g.myTurn, g.mustReturn)}</p> : null}
          {over ? (
            <div data-slot="pills">
              {g.table[HUMAN] && !three ? <PlayZone game={game} record={g.table[HUMAN]} seat={HUMAN} /> : null}
              <Button data-variant="play" onClick={() => setResultFor(game)}>
                查看结果
              </Button>
            </div>
          ) : acting ? (
            <div data-slot="pills">
              {g.mustReturn ? (
                <Button data-variant="play" onClick={g.giveBack}>
                  还贡
                </Button>
              ) : (
                <>
                  <Button data-variant="pass" onClick={g.passTurn} disabled={!g.canPass}>
                    不出
                  </Button>
                  <Button data-variant="hint" onClick={g.hint}>
                    提示
                  </Button>
                  <Button data-variant="play" onClick={g.playSelected}>
                    出牌
                  </Button>
                </>
              )}
            </div>
          ) : three ? (
            <div data-slot="pills" />
          ) : (
            <section data-slot="pills" aria-label="你出的牌">
              <PlayZone game={game} record={g.table[HUMAN]} seat={HUMAN} />
            </section>
          )}
          <div
            data-slot="hand"
            data-filter={suit[0]}
            role="group"
            aria-label={`你的手牌，共 ${g.hand.length} 张`}
            {...swipe}
          >
            {columns.map((column) => (
              <div
                key={column.key}
                data-slot="hand-column"
                data-custom={column.custom ? "" : undefined}
                role="group"
                aria-label={`${column.label}，${column.cards.length} 张`}
              >
                {column.custom ? (
                  <Button
                    data-variant="pile"
                    aria-label={`选中这组牌（${column.label}）`}
                    onClick={() => g.selectPile(column.cards.map((c) => c.id))}
                  >
                    {column.name}
                  </Button>
                ) : null}
                {column.cards.map((card) => (
                  <Toggle
                    key={card.id}
                    {...cardAttributes(card, game.level)}
                    data-card-id={card.id}
                    aria-label={cardLabel(card, game.level)}
                    pressed={g.selected.includes(card.id)}
                    onPressedChange={(pressed) => g.toggle(card, pressed)}
                  >
                    {three ? <CardFace3D card={card} level={game.level} /> : <CardFace card={card} level={game.level} />}
                  </Toggle>
                ))}
              </div>
            ))}
          </div>
        </section>

        <footer data-slot="bottombar">
          <div data-slot="me-chip" data-active={acting ? "" : undefined}>
            <span data-slot="avatar" aria-hidden="true">
              你
            </span>
            <span>{myPlace >= 0 ? PLACE_NAMES[myPlace] : `剩 ${g.hand.length} 张`}</span>
            {acting ? <span data-slot="me-turn">{g.mustReturn ? "请还贡" : "轮到你出牌"}</span> : null}
          </div>
          <div data-slot="tools" data-pile-selected={g.pileSelected ? "" : undefined}>
            <ToggleGroup aria-label="按花色查看" value={suit} onValueChange={setSuit}>
              {SUITS.map(([value, symbol, label]) => (
                <Toggle key={value} value={value} aria-label={label} data-suit-filter={value}>
                  {symbol}
                </Toggle>
              ))}
            </ToggleGroup>
            <Button data-variant="text" data-find-flush="" onClick={g.findFlush} disabled={g.hand.length < 5}>
              同花顺
            </Button>
            <Button data-variant="text" onClick={g.arrange} disabled={g.selected.length === 0}>
              理牌
            </Button>
            {g.pileSelected ? (
              <>
                <Button data-variant="text" aria-label="把这组牌左移" onClick={() => g.movePile(-1)} disabled={!g.canMoveLeft}>
                  ←
                </Button>
                <Button data-variant="text" aria-label="把这组牌右移" onClick={() => g.movePile(1)} disabled={!g.canMoveRight}>
                  →
                </Button>
              </>
            ) : null}
            <Button data-variant="text" onClick={g.restore} disabled={g.groups.length === 0}>
              {g.selected.length > 0 ? "拆开" : "恢复"}
            </Button>
            <Toggle data-tool-toggle="" pressed={trackerOn} onPressedChange={setTrackerOn}>
              记牌器
            </Toggle>
          </div>
        </footer>
      </div>

      <button type="button" data-slot="scrim" aria-label="收起教练" onClick={() => setCoachOpen(false)} />
      <Coach g={g} onClose={() => setCoachOpen(false)} onHide={hideCoach} />
      <ResultDialog
        game={game}
        open={over && resultFor === game}
        onOpenChange={(open) => setResultFor(open ? game : null)}
        onNext={g.nextHand}
        saveFailed={g.saveFailed}
      />
      <ResumeDialog save={g.offer} onResume={g.resume} onNew={g.startOver} />
    </main>
  )
}

export { App }
