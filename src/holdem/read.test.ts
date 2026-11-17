import { describe, expect, it } from "vitest"
import { newDeck, shuffle } from "./cards"
import { evaluate } from "./hands"
import { unseenCards } from "./odds"
import { Strength, countOuts, readHand, ruleOfThumb } from "./read"
import { cards, seeded } from "./testing"

describe("reading a hand the way a player does", () => {
  it("calls ace-jack on a queen-high board ace high, with three aces to make top pair", () => {
    const hole = cards("AH JH")
    const board = cards("8D QS 2H")
    expect(readHand(hole, board)).toMatchObject({ text: "只有 A 高，还没成牌", strength: Strength.Nothing })
    // A jack only makes the second pair, which is not a card a player should count on.
    expect(countOuts(hole, board)).toEqual({ count: 3, text: "来一张 A 就成顶对（还剩 3 张）" })
    expect(ruleOfThumb(3, board)).toEqual({ times: 4, percent: 12 })
  })

  it("counts a flush draw and the overcard together", () => {
    const outs = countOuts(cards("AH JH"), cards("KH 9H 4S"))
    expect(outs).toEqual({ count: 12, text: "来一张红桃就成同花（还剩 9 张）；来一张 A 就成顶对（还剩 3 张）" })
    expect(ruleOfThumb(outs.count, cards("KH 9H 4S 2C"))).toEqual({ times: 2, percent: 24 })
  })

  it("names top pair with its kicker, and the cards that make two pair or trips", () => {
    expect(readHand(cards("KS QD"), cards("KH 7C 2D"))).toMatchObject({ text: "顶对 K，踢脚 Q，踢脚不错", strength: Strength.TopPair })
    expect(countOuts(cards("KS QD"), cards("KH 7C 2D"))).toEqual({ count: 5, text: "来一张 Q 就成两对（还剩 3 张）；来一张 K 就成三条（还剩 2 张）" })
    expect(readHand(cards("KS 4D"), cards("KH 7C 2D")).text).toBe("顶对 K，踢脚 4，踢脚偏小")
  })

  it("tells an overpair, a weaker pocket pair, middle and bottom pair apart", () => {
    expect(readHand(cards("AS AD"), cards("KH 7C 2D")).strength).toBe(Strength.Overpair)
    expect(readHand(cards("5S 5D"), cards("KH 7C 2D")).text).toBe("一对 5：口袋对子，但公共牌上有比它大的牌")
    expect(readHand(cards("7S QD"), cards("KH 7C 2D")).text).toBe("中对 7：公共牌上有比它大的牌")
    expect(readHand(cards("2S QD"), cards("KH 7C 2D")).text).toBe("底对 2：公共牌上有比它大的牌")
  })

  it("does not credit the player with what is only on the board", () => {
    expect(readHand(cards("5S 6D"), cards("KH KC 2D"))).toMatchObject({ text: "只有 6 高：这对 K 在公共牌上，大家都有", strength: Strength.Nothing })
    // Two pair with one pair on the board is only the player's own pair.
    expect(readHand(cards("7S 3D"), cards("KH KC 7D")).text).toBe("底对 7：公共牌上有比它大的牌")
  })

  it("does not count a card that only improves the board as an out", () => {
    // A 2 makes two pair and a 6 makes three of a kind, but both are on the board for everyone. Only a 4 helps.
    expect(countOuts(cards("5D 3S"), cards("6H 6C 2C"))).toEqual({ count: 4, text: "来一张 4 就成顺子（还剩 4 张）" })
    expect(readHand(cards("5D 3S"), cards("6H 6C 2C 2D")).text).toBe("只有 5 高：公共牌上的两对大家都有")
    expect(readHand(cards("5D 3S"), cards("6H 6C 6D 2C")).text).toBe("只有 5 高：公共牌上的三条大家都有")
  })

  it("does not credit the player with a straight that is all on the board", () => {
    // The player's 5 can stand in for the board's 5 in the board's straight, but it changes nothing.
    expect(readHand(cards("5H 2D"), cards("5S 6D 7C 8H 9S"))).toMatchObject({ text: "顺子 到 9：这手牌全在公共牌上，大家都有", strength: Strength.Nothing })
    // So on the turn a 4 or a 9 is not an out: it gives everyone the same straight.
    expect(countOuts(cards("5H 2D"), cards("5S 6D 7C 8H"))).toEqual({ count: 5, text: "来一张 2 就成两对（还剩 3 张）；来一张 5 就成三条（还剩 2 张）" })
  })

  it("reads a river where neither of the player's cards plays as the board's hand", () => {
    const read = readHand(cards("3H 2D"), cards("AS KC QD JH 9S"))
    expect(read).toMatchObject({ strength: Strength.Nothing, boardOnly: true })
    expect(read.text).toMatch(/：这手牌全在公共牌上，大家都有$/)
    expect(read.text).not.toMatch(/3 高/)
    // One card that beats the board's last one does play.
    const ten = readHand(cards("TH 2D"), cards("AS KC QD 7H 4S"))
    expect(ten.text).toBe("只有 10 高，还没成牌")
    expect(ten.boardOnly).toBeUndefined()
  })

  it("lets the fifth card decide when four of a kind is on the board", () => {
    // Kings with an ace: nobody can beat it.
    expect(readHand(cards("AH 2D"), cards("KS KC KD KH 3S"))).toMatchObject({ strength: Strength.Strong, nuts: true, text: "四条 K 在公共牌上，你的 A 是最大的第五张，没人能赢你" })
    // A queen beats the board's 3 but loses to anyone with an ace or a king.
    expect(readHand(cards("QH 2D"), cards("KS KC KD KH 3S"))).toMatchObject({ strength: Strength.Nothing, text: "只有 Q 高：公共牌上的四条大家都有，比的是第五张" })
    // Aces on the board: a king is the best fifth card.
    expect(readHand(cards("KH 2D"), cards("AS AC AD AH 3S")).nuts).toBe(true)
    // When the board's own fifth card is higher, the player's cards play no part.
    expect(readHand(cards("4H 2D"), cards("KS KC KD KH 9S")).text).toBe("四条 K：这手牌全在公共牌上，大家都有")
  })

  it("names the ranks of outs that are neither one rank nor one suit", () => {
    expect(countOuts(cards("7D 6C"), cards("9S 8H 2C"))).toEqual({ count: 8, text: "来一张 10 或 5 就成顺子（还剩 8 张）" })
    // The two hearts among the straight cards make a flush, so they are counted there.
    expect(countOuts(cards("QH JH"), cards("TH 9S 2H")).text).toBe("来一张红桃就成同花（还剩 9 张）；来一张 K 或 8 就成顺子（还剩 6 张）；来一张 Q 或 J 就成顶对（还剩 6 张）")
  })

  it("names sets, trips and made hands as strong, with no outs to count", () => {
    expect(readHand(cards("7S 7D"), cards("7H KC 2D")).text).toBe("暗三条 7：口袋对子中了第三张，很强")
    expect(readHand(cards("AH 5H"), cards("KH 9H 2H")).strength).toBe(Strength.Strong)
    expect(countOuts(cards("AH 5H"), cards("KH 9H 2H"))).toEqual({ count: 0, text: null })
  })
})

describe("outs on random flops and turns", () => {
  it("counts only cards that give the player a better hand than the board alone", () => {
    const rng = seeded(21)
    let checked = 0
    for (let deal = 0; deal < 300; deal++) {
      const deck = shuffle(newDeck(), rng)
      const hole = deck.slice(0, 2)
      const board = deck.slice(2, deal % 2 === 0 ? 5 : 6)
      const target = countOuts(hole, board).count
      const helping = unseenCards([...hole, ...board]).filter((card) => {
        const mine = evaluate([...hole, ...board, card]).score
        return mine > evaluate([...board, card]).score
      })
      // Every out is among the cards that make the player's own hand better than the board's.
      expect(target).toBeLessThanOrEqual(helping.length)
      const read = readHand(hole, board)
      if (read.strength > Strength.Nothing) expect(evaluate([...hole, ...board]).score).toBeGreaterThan(evaluate(board).score)
      checked++
    }
    expect(checked).toBe(300)
  })
})
