import { describe, expect, it } from "vitest"
import { CATEGORIES, categoryName, describeHand, evaluate } from "./hands"
import { cards } from "./testing"

const hand = (names: string) => evaluate(cards(names))

describe("hand ranking", () => {
  const examples: [string, string][] = [
    ["straightFlush", "9H 8H 7H 6H 5H AS KD"],
    ["quads", "KS KH KD KC 2S 3D 9H"],
    ["fullHouse", "KS KH KD 9C 9S 3D 2H"],
    ["flush", "AH JH 9H 7H 4H KS 2C"],
    ["straight", "9S 8H 7D 6C 5S AD KD"],
    ["trips", "KS KH KD 9C 7S 3D 2H"],
    ["twoPair", "KS KH 9D 9C 7S 3D 2H"],
    ["pair", "KS KH 9D 8C 7S 3D 2H"],
    ["highCard", "AS JH 9D 8C 6S 3D 2H"],
  ]

  it("names every category and ranks them in order", () => {
    const values = examples.map(([, names]) => hand(names))
    expect(values.map((v) => v.category)).toEqual(CATEGORIES)
    for (let i = 1; i < values.length; i++) expect(values[i - 1].score).toBeGreaterThan(values[i].score)
    expect(CATEGORIES.map(categoryName)).toEqual(["同花顺", "四条", "葫芦", "同花", "顺子", "三条", "两对", "一对", "高牌"])
  })

  it("picks the best five of seven", () => {
    expect(hand("AH JH 9H 7H 4H KS 2C").cards.map((c) => c.rank)).toEqual([14, 11, 9, 7, 4])
    expect(hand("KS KH KD 9C 9S 3D 3H").cards.map((c) => c.rank)).toEqual([13, 13, 13, 9, 9])
    expect(hand("TS 9H 8D 7C 6S 5D 4H").cards.map((c) => c.rank)).toEqual([10, 9, 8, 7, 6])
  })

  it("plays the ace low in A-2-3-4-5, the lowest straight", () => {
    const wheel = hand("AS 2H 3D 4C 5S KD 9H")
    expect(wheel.category).toBe("straight")
    expect(wheel.cards[0].rank).toBe(5)
    expect(hand("2S 3H 4D 5C 6S KD 9H").score).toBeGreaterThan(wheel.score)
    expect(wheel.score).toBeGreaterThan(hand("AS AH AD 4C 5S KD 9H").score)
  })

  it("breaks ties inside a category with the next cards", () => {
    expect(hand("AS AH KD 7C 4S 3D 2H").score).toBeGreaterThan(hand("AD AC QD 7C 4S 3D 2H").score)
    expect(hand("KS KH 9D 9C AS 3D 2H").score).toBeGreaterThan(hand("KS KH 9D 9C QS 3D 2H").score)
    expect(hand("QS QH QD 2C 2S 5D 7H").score).toBeGreaterThan(hand("JS JH JD AC AS 5D 7H").score)
    expect(hand("AH TH 9H 7H 4H 2S 3C").score).toBeGreaterThan(hand("KH QH 9H 7H 4H 2S 3C").score)
    expect(hand("AS KH QD JC TS 2D 3H").score).toBe(hand("AD KC QH JS TD 4D 5H").score)
  })

  it("describes a hand the way a player would", () => {
    expect(describeHand(hand("AH JH 9H 7H 4H KS 2C"))).toBe("A 高的红桃同花")
    expect(describeHand(hand("KS KH KD 9C 7S 3D 2H"))).toBe("三条 K")
    expect(describeHand(hand("KS KH 9D 9C 7S 3D 2H"))).toBe("两对 K 和 9")
    expect(describeHand(hand("KS KH KD 9C 9S 3D 2H"))).toBe("葫芦 K 带 9")
    expect(describeHand(hand("9S 8H 7D 6C 5S AD KD"))).toBe("顺子 到 9")
    expect(describeHand(hand("AS JH 9D 8C 6S 3D 2H"))).toBe("高牌 A")
  })
})
