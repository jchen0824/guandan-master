import { useEffect, useRef, useState } from "react"
import type { ReactNode } from "react"
import { rankLabel } from "../engine/cards"
import { bombPower, comboTypeName, describeCombo } from "../engine/combos"
import type { GameState, PlayRecord } from "../engine/game"
import { cardAttributes, cardLabel } from "./cardAttributes"
import { CardFace3D } from "./CardFace3D"
import { SEAT_NAMES, SIDES } from "./names"
import { place } from "./place"
import { Player } from "./Player"
import { useFreshBomb } from "./useFreshBomb"

const BACKS = Array.from({ length: 27 }, (_, index) => `back-${index}`)
const SLABS = ["slab-1", "slab-2", "slab-3"]
const SEATS = [3, 2, 1]
const RINGS = ["ring-1", "ring-2", "ring-3"]
/** Where each spark of a bomb ends up, in design pixels from the middle of the play, and how long it waits. */
const SPARKS = Array.from({ length: 16 }, (_, i) => {
  const angle = (i / 16) * Math.PI * 2 + 0.2
  const far = 210 + (i % 4) * 45
  return {
    key: `spark-${i}`,
    to: { i, dx: Math.round(Math.cos(angle) * far), dy: Math.round(Math.sin(angle) * far * 0.8), dz: 70 + (i % 5) * 34, wait: (i % 5) * 18 },
  }
})
const SHAKE = ["0 0", "0 8px", "-5px -5px", "4px 3px", "0 0"].map((translate) => ({ translate }))

/** Tilts the table a few degrees toward the mouse, which makes the depth readable. Touch screens stay still. */
function Scene({ game, children }: { game: GameState; children: ReactNode }) {
  const [sway, setSway] = useState({ sx: 0, sy: 0 })
  const scene = useRef<HTMLDivElement>(null)
  const bomb = useFreshBomb(game)
  useEffect(() => {
    // The table jolts as a bomb lands. The delay is the time the cards take to fall (see `slam` in index.css).
    if (!bomb || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return
    scene.current?.animate?.(SHAKE, { duration: 330, delay: 480 })
  }, [bomb])
  useEffect(() => {
    if (!window.matchMedia?.("(hover: hover) and (pointer: fine)").matches) return
    const follow = (event: PointerEvent) => {
      const sx = Math.round((event.clientX / window.innerWidth - 0.5) * 20)
      const sy = Math.round((event.clientY / window.innerHeight - 0.5) * 20)
      setSway((now) => (now.sx === sx && now.sy === sy ? now : { sx, sy }))
    }
    window.addEventListener("pointermove", follow)
    return () => window.removeEventListener("pointermove", follow)
  }, [])
  return (
    // oxlint-disable-next-line react/forbid-dom-props -- sets only the two custom properties that tilt the table; the rules that use them are in index.css
    <div ref={scene} data-slot="scene" style={place(sway)}>
      {children}
    </div>
  )
}

/** A hand held upright: one card back per card the seat still holds. */
function Fan({ count }: { count: number }) {
  return (
    <div data-slot="fan" aria-hidden="true">
      {BACKS.slice(0, count).map((key, i) => (
        // oxlint-disable-next-line react/forbid-dom-props -- sets only the custom properties that place this card in the fan
        <span key={key} data-slot="fan-card" style={place({ i, n: count })} />
      ))}
    </div>
  )
}

/** What a bomb does to the felt under it: a flash and three rings spreading out. Its sparks are in Play3D. */
function Shockwave({ side }: { side: string }) {
  return (
    <>
      <span data-slot="flash" data-side={side} />
      {RINGS.map((key, i) => (
        // oxlint-disable-next-line react/forbid-dom-props -- sets only the custom property that delays this ring
        <span key={key} data-slot="ring" data-side={side} style={place({ i })} />
      ))}
    </>
  )
}

function Play3D({ game, record, seat }: { game: GameState; record: PlayRecord | null; seat: number }) {
  const combo = record?.combo ?? null
  const bomb = combo !== null && bombPower(combo) > 0
  return (
    <div data-slot="play-zone" data-side={SIDES[seat]} data-bomb={bomb ? "" : undefined}>
      {bomb ? (
        <span key={combo.cards[0].id} data-slot="blast" aria-hidden="true">
          {SPARKS.map((spark) => (
            // oxlint-disable-next-line react/forbid-dom-props -- sets only the custom properties that say where this spark flies
            <span key={spark.key} data-slot="spark" style={place(spark.to)} />
          ))}
        </span>
      ) : null}
      {record === null ? null : combo === null ? (
        <span data-slot="pass-mark">不出</span>
      ) : (
        <>
          <span data-slot="play-tag" aria-hidden="true">
            {comboTypeName(combo.type)}
          </span>
          {/* Keyed by the play, so the row flies in again when this seat plays again. */}
          <ul key={combo.cards[0].id} data-slot="card-row" aria-label={`${SEAT_NAMES[seat]}出的牌：${describeCombo(combo, game.level)}`}>
            {combo.cards.map((card, i) => (
              // oxlint-disable-next-line react/forbid-dom-props -- sets only the custom properties that place this card in its row
              <li key={card.id} {...cardAttributes(card, game.level)} style={place({ i, n: combo.cards.length })}>
                <span data-slot="visually-hidden">{cardLabel(card, game.level)}</span>
                <span aria-hidden="true" data-slot="card-face">
                  <CardFace3D card={card} level={game.level} />
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

/** The table in perspective: the felt, three hands held upright, and every seat's last play lying on it. */
function Table3D({ game, table }: { game: GameState; table: (PlayRecord | null)[] }) {
  return (
    <Scene game={game}>
      <div data-slot="world">
        <div data-slot="table-base" aria-hidden="true">
          <span data-slot="floor" />
          {SLABS.map((key, i) => (
            // oxlint-disable-next-line react/forbid-dom-props -- sets only the custom property that stacks this layer of the table edge
            <span key={key} data-slot="slab" style={place({ i })} />
          ))}
        </div>
        {/* Everything that lies flat on the table is drawn here, in this order, as one surface. */}
        <div data-slot="tabletop" aria-hidden="true">
          <span data-slot="felt" />
          <span data-slot="inlay" />
          <span data-slot="felt-print">
            <span>本局打</span>
            <b>{rankLabel(game.level)}</b>
          </span>
          <span data-slot="glow" data-side={game.lastPlay ? SIDES[game.lastPlay.player] : undefined} />
          {SEATS.map((seat) => (
            <span key={SEAT_NAMES[seat]} data-slot="fan-shade" data-side={SIDES[seat]} />
          ))}
          {table.map((record) => (record?.combo && bombPower(record.combo) > 0 ? <Shockwave key={record.combo.cards[0].id} side={SIDES[record.player]} /> : null))}
        </div>
        {SEATS.map((seat) => (
          <section key={SEAT_NAMES[seat]} data-slot="seat3d" data-side={SIDES[seat]} aria-label={SEAT_NAMES[seat]}>
            <Fan count={game.hands[seat].length} />
            <Play3D game={game} record={table[seat]} seat={seat} />
          </section>
        ))}
        <section data-slot="seat3d" data-side="me" aria-label="你出的牌">
          <Play3D game={game} record={table[0]} seat={0} />
        </section>
      </div>
      {/* A second layer with the same camera, drawn after the table, so a seat label is never hidden behind a fan. */}
      <div data-slot="world" data-layer="labels">
        {SEATS.map((seat) => (
          <div key={SEAT_NAMES[seat]} data-slot="seat3d" data-side={SIDES[seat]}>
            <Player game={game} seat={seat} />
          </div>
        ))}
      </div>
    </Scene>
  )
}

export { Table3D }
