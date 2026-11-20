// Points from 番 and 符, and who pays them.

const MANGAN = 2000

/** The basic points of a hand: a non-dealer's 自摸 costs each other non-dealer this much. */
export function basePoints(han: number, fu: number, yakuman: number): number {
  if (yakuman > 0) return 8000 * yakuman
  if (han >= 13) return 8000
  if (han >= 11) return 6000
  if (han >= 8) return 4000
  if (han >= 6) return 3000
  if (han >= 5) return MANGAN
  return Math.min(MANGAN, fu * 2 ** (han + 2))
}

/** 满贯 and above have a name; a smaller hand has none. */
export function limitName(han: number, fu: number, yakuman: number): string | null {
  if (yakuman > 1) return `${yakuman} 倍役满`
  if (yakuman === 1) return "役满"
  if (han >= 13) return "累计役满"
  if (han >= 11) return "三倍满"
  if (han >= 8) return "倍满"
  if (han >= 6) return "跳满"
  return basePoints(han, fu, 0) === MANGAN ? "满贯" : null
}

const roundUp = (amount: number) => Math.ceil(amount / 100) * 100

/**
 * What each of the four seats gains or loses for one win, 本场 included. `from` is the seat that discarded the
 * winning tile, or null for 自摸, where the dealer pays or is paid double.
 */
export function payments(win: { seat: number; from: number | null; dealer: number; base: number; honba: number }): number[] {
  const { seat, from, dealer, base, honba } = win
  const deltas = [0, 0, 0, 0]
  if (from !== null) {
    const amount = roundUp(base * (seat === dealer ? 6 : 4)) + 300 * honba
    deltas[from] -= amount
    deltas[seat] += amount
    return deltas
  }
  for (let payer = 0; payer < 4; payer++) {
    if (payer === seat) continue
    const amount = roundUp(base * (seat === dealer || payer === dealer ? 2 : 1)) + 100 * honba
    deltas[payer] -= amount
    deltas[seat] += amount
  }
  return deltas
}
