import { Button } from "@ui-sdk/react/button"
import { describeSituation } from "./situation"
import type { Game } from "./useGame"

const BOMB_LADDER = [
  ["四大天王", "最大"],
  ["六张及以上", "张数多者大"],
  ["同花顺", "压四张、五张"],
  ["五张炸弹", ""],
  ["四张炸弹", "最小"],
]

function Coach({ g, onClose, onHide }: { g: Game; onClose: () => void; onHide: () => void }) {
  const { game } = g
  return (
    <aside data-slot="coach" aria-label="教练">
      <header data-slot="coach-header">
        <h2>教练</h2>
        <div data-slot="coach-buttons">
          <Button data-variant="text" onClick={onHide}>
            隐藏教练
          </Button>
          <Button data-variant="text" data-coach-close="" onClick={onClose}>
            收起
          </Button>
        </div>
      </header>
      <section>
        <h3>当前局面</h3>
        <p>{describeSituation(game, g.myTurn, g.mustReturn).long}</p>
      </section>
      <section>
        <h3>点评</h3>
        {g.feedback.length === 0 ? (
          <p data-slot="coach-empty">你每出一手牌，教练都会告诉你它会怎么出、为什么。</p>
        ) : (
          <ul data-slot="coach-feedback">
            {g.feedback.map((item) => (
              <li key={item.id} data-agreed={item.agreed ? "" : undefined}>
                <strong>{item.agreed ? "好棋" : "可以更好"}</strong>
                {item.text}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h3>炸弹大小</h3>
        <ol data-slot="ladder">
          {BOMB_LADDER.map(([name, note]) => (
            <li key={name}>
              <span>{name}</span>
              <span>{note}</span>
            </li>
          ))}
        </ol>
      </section>
    </aside>
  )
}

export { Coach }
