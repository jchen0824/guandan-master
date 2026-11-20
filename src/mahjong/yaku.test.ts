import { describe, expect, it } from "vitest"
import { basePoints, limitName, payments } from "./score"
import { counts, kinds } from "./testing"
import { EAST, doraOf } from "./tiles"
import { valueOf } from "./yaku"
import type { CalledSet, WinInput } from "./yaku"

/** A win on `tile` with the concealed tiles `hand` (the winning tile among them): a discard unless told otherwise. */
function win(hand: string, tile: string, more: Partial<WinInput> = {}) {
  return valueOf({
    counts: counts(hand),
    called: [],
    winKind: kinds(tile)[0],
    tsumo: false,
    seatWind: EAST + 1,
    roundWind: EAST,
    riichi: 0,
    ippatsu: false,
    rinshan: false,
    chankan: false,
    lastTile: false,
    firstTurn: false,
    dealer: false,
    dora: 0,
    ura: 0,
    ...more,
  })
}
const names = (value: ReturnType<typeof win>) => value?.yaku.map((yaku) => yaku.name)
const pon = (tile: string): CalledSet => ({ type: "pon", kind: kinds(tile)[0] })
const chi = (tile: string): CalledSet => ({ type: "chi", kind: kinds(tile)[0] })

describe("役", () => {
  it("counts 立直, 自摸, 平和 and 断幺九 at 20 符", () => {
    const value = win("234567m345p678s88s", "6s", { tsumo: true, riichi: 1 })
    expect(names(value)).toEqual(["立直", "门前清自摸和", "平和", "断幺九"])
    expect(value).toMatchObject({ han: 4, fu: 20, base: 1280 })
  })

  it("gives 平和 on a discard 30 符, and none for a middle wait", () => {
    expect(win("123m456m789p234s55s", "4s")).toMatchObject({ han: 1, fu: 30 })
    expect(names(win("123m456m789p234s55s", "4s"))).toEqual(["平和"])
    expect(win("123m456m789p234s55s", "3s")).toBeNull()
  })

  it("refuses a finished hand with no 役, and 宝牌 do not make one", () => {
    expect(win("456m789p234s55s", "5s", { called: [pon("2m")], dora: 3 })).toBeNull()
  })

  it("lets an open hand win on 役牌", () => {
    const value = win("456m789p234s55s", "5s", { called: [pon("7z")], dora: 1 })
    expect(names(value)).toEqual(["役牌 中", "宝牌"])
    expect(value).toMatchObject({ han: 2, fu: 30 })
  })

  it("counts the seat wind and the round wind, twice when they are the same", () => {
    expect(names(win("456m789p234s55s", "5s", { called: [pon("1z")] }))).toEqual(["场风 东"])
    expect(names(win("456m789p234s55s", "5s", { called: [pon("1z")], seatWind: EAST }))).toEqual(["场风 东", "自风 东"])
  })

  it("reads 七对子 at 25 符", () => {
    expect(win("1133m5577p2244s11z", "1z")).toMatchObject({ han: 2, fu: 25 })
  })

  it("prefers 二杯口 to 七对子 when the tiles make both", () => {
    expect(names(win("223344m667788p55s", "5s"))).toEqual(["断幺九", "二杯口"])
  })

  it("takes the dearer reading of 111222333", () => {
    expect(names(win("111222333m456s55p", "5p", { tsumo: true }))).toEqual(["门前清自摸和", "三暗刻"])
    expect(names(win("111222333m789s99p", "9p"))).toEqual(["一杯口", "纯全带幺九"])
  })

  it("makes a triplet finished by a discard an open one", () => {
    const value = win("111m333p555s777s22z", "7s")
    expect(names(value)).toEqual(["对对和", "三暗刻"])
    expect(value).toMatchObject({ han: 4, fu: 50, limit: "满贯" })
    expect(names(win("111m333p555s777s22z", "7s", { tsumo: true }))).toEqual(["四暗刻"])
  })

  it("takes one 番 off 一气通贯, 三色同顺 and 混一色 in an open hand", () => {
    expect(win("123456789m234p55s", "5s")?.yaku).toEqual([{ name: "一气通贯", han: 2 }])
    expect(win("456789m234p55s", "5s", { called: [chi("1m")] })?.yaku).toEqual([{ name: "一气通贯", han: 1 }])
    expect(win("234m234p234s678m99p", "9p")?.yaku).toEqual([{ name: "三色同顺", han: 2 }])
    expect(win("123456m999m11z", "1z", { called: [pon("3z")] })?.yaku).toEqual([{ name: "混一色", han: 2 }])
    expect(names(win("123456m234m678m55m", "5m"))).toContain("清一色")
  })

  it("counts 岭上开花, 抢杠, 海底摸月 and 一发", () => {
    const hand = ["456m789p234s55s", "5s", { called: [pon("2m")] }] as const
    expect(names(win(hand[0], hand[1], { ...hand[2], tsumo: true, rinshan: true }))).toEqual(["岭上开花"])
    expect(names(win(hand[0], hand[1], { ...hand[2], chankan: true }))).toEqual(["抢杠"])
    expect(names(win(hand[0], hand[1], { ...hand[2], tsumo: true, lastTile: true }))).toEqual(["海底摸月"])
    expect(names(win(hand[0], hand[1], { ...hand[2], lastTile: true }))).toEqual(["河底捞鱼"])
    expect(names(win("123m456m789p234s55s", "3s", { riichi: 1, ippatsu: true, ura: 2 }))).toEqual(["立直", "一发", "里宝牌"])
  })

  it("knows the 役满", () => {
    expect(names(win("19m19p19s12345677z", "7z"))).toEqual(["国士无双"])
    expect(names(win("123m55s", "5s", { called: [pon("5z"), pon("6z"), pon("7z")] }))).toEqual(["大三元"])
    expect(names(win("111222333z555z44z", "4z", { tsumo: true }))).toEqual(["四暗刻", "小四喜", "字一色"])
    expect(names(win("11122345678999m", "2m"))).toEqual(["九莲宝灯"])
    expect(names(win("223344s666s888s66z", "6z"))).toEqual(["绿一色"])
    expect(names(win("123m456m789p234s55s", "3s", { tsumo: true, firstTurn: true, dealer: true }))).toEqual(["天和"])
    expect(win("19m19p19s12345677z", "7z")).toMatchObject({ yakuman: 1, base: 8000, limit: "役满" })
  })
})

describe("点数", () => {
  it("turns 番 and 符 into basic points, capped at 满贯", () => {
    expect(basePoints(1, 30, 0)).toBe(240)
    expect(basePoints(4, 30, 0)).toBe(1920)
    expect(basePoints(3, 70, 0)).toBe(2000)
    expect([5, 6, 8, 11, 13].map((han) => limitName(han, 30, 0))).toEqual(["满贯", "跳满", "倍满", "三倍满", "累计役满"])
    expect(limitName(4, 30, 0)).toBeNull()
  })

  it("has the discarder pay a 荣和 alone, 本场 included", () => {
    expect(payments({ seat: 1, from: 3, dealer: 0, base: 1920, honba: 0 })).toEqual([0, 7700, 0, -7700])
    expect(payments({ seat: 0, from: 3, dealer: 0, base: 1920, honba: 2 })).toEqual([12200, 0, 0, -12200])
  })

  it("splits a 自摸, the dealer paying or being paid double", () => {
    expect(payments({ seat: 1, from: null, dealer: 0, base: 240, honba: 1 })).toEqual([-600, 1400, -400, -400])
    expect(payments({ seat: 0, from: null, dealer: 0, base: 2000, honba: 0 })).toEqual([12000, -4000, -4000, -4000])
  })

  it("points an indicator at the next tile, wrapping round", () => {
    expect([8, 9, 30, 31, 33].map(doraOf)).toEqual([0, 10, 27, 32, 31])
  })
})
