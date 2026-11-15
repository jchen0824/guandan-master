import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import { rankLabel } from "../engine/cards"
import { comboTypeName, describeCombo } from "../engine/combos"
import type { GameState, PlayRecord } from "../engine/game"
import { cardAttributes, cardLabel } from "./cardAttributes"
import { CardFace3D } from "./CardFace3D"
import { SEAT_NAMES, SIDES } from "./names"
import { place } from "./place"
import { Player } from "./Player"

const BACKS = Array.from({ length: 27 }, (_, index) => `back-${index}`)
const SLABS = ["slab-1", "slab-2", "slab-3", "slab-4", "slab-5", "slab-6"]

/** Tilts the table a few degrees toward the mouse, which makes the depth readable. Touch screens stay still. */
function Scene({ children }: { children: ReactNode }) {
  const [sway, setSway] = useState({ sx: 0, sy: 0 })
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
    <div data-slot="scene" style={place(sway)}>
      {children}
    </div>
  )
}

/** A hand held upright: one card back per card the seat still holds. */
function Fan({ count }: { count: number }) {
  return (
    <div data-slot="fan" aria-hidden="true">
      <span data-slot="fan-shade" />
      {BACKS.slice(0, count).map((key, i) => (
        // oxlint-disable-next-line react/forbid-dom-props -- sets only the custom properties that place this card in the fan
        <span key={key} data-slot="fan-card" style={place({ i, n: count })} />
      ))}
    </div>
  )
}

function Play3D({ game, record, seat }: { game: GameState; record: PlayRecord | null; seat: number }) {
  const combo = record?.combo ?? null
  return (
    <div data-slot="play-zone" data-side={SIDES[seat]}>
      {record === null ? null : combo === null ? (
        <span data-slot="pass-mark">不出</span>
      ) : (
        <>
          <span data-slot="play-tag" aria-hidden="true">
            {comboTypeName(combo.type)}
          </span>
          <ul data-slot="card-row" aria-label={`${SEAT_NAMES[seat]}出的牌：${describeCombo(combo, game.level)}`}>
            {combo.cards.map((card, i) => (
              // oxlint-disable-next-line react/forbid-dom-props -- sets only the custom properties that place this card on the felt
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
    <Scene>
      <div data-slot="world">
        <div data-slot="table-parts" aria-hidden="true">
          <span data-slot="floor" />
          {SLABS.map((key, i) => (
            // oxlint-disable-next-line react/forbid-dom-props -- sets only the custom property that stacks this layer of the table edge
            <span key={key} data-slot="slab" style={place({ i })} />
          ))}
          <span data-slot="rim" />
          <span data-slot="felt" />
          <span data-slot="inlay" />
          <span data-slot="felt-print">
            <span>本局打</span>
            <b>{rankLabel(game.level)}</b>
          </span>
          <span data-slot="glow" data-side={game.lastPlay ? SIDES[game.lastPlay.player] : undefined} />
        </div>
        {[3, 2, 1].map((seat) => (
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
        {[3, 2, 1].map((seat) => (
          <div key={SEAT_NAMES[seat]} data-slot="seat3d" data-side={SIDES[seat]}>
            <Player game={game} seat={seat} />
          </div>
        ))}
      </div>
    </Scene>
  )
}

export { Table3D }
