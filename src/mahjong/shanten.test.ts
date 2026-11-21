import { describe, expect, it } from "vitest"
import { shanten, usefulKinds, waits } from "./shanten"
import { counts, kinds } from "./testing"

describe("向听", () => {
  it("is -1 for a finished hand and 0 at 听牌", () => {
    expect(shanten(counts("123m456p789s11222z"))).toBe(-1)
    expect(shanten(counts("123m456p789s1122z"))).toBe(0)
  })

  it("counts the steps of a hand that is far away", () => {
    expect(shanten(counts("147m258p369s1234z"))).toBe(6)
    expect(shanten(counts("23467m345p56s88s3z"))).toBe(1)
    expect(shanten(counts("1199m1199p1199s1z"))).toBe(0)
  })

  it("reads 七对子 and 国士无双 as well as four sets and a pair", () => {
    expect(shanten(counts("1133m5577p2244s1z"))).toBe(0)
    expect(shanten(counts("19m19p19s1234567z"))).toBe(0)
    expect(shanten(counts("19m19p19s12345677z"))).toBe(-1)
  })

  it("counts called sets as finished, and then only four sets and a pair", () => {
    expect(shanten(counts("1122z"), 3)).toBe(0)
    expect(shanten(counts("1133m5577p"), 1)).toBe(2)
  })

  it("lists the tiles that improve a hand", () => {
    expect(usefulKinds(counts("23467m345p56s88s3z"))).toEqual(kinds("58m47s"))
  })

  it("lists the waits of a hand at 听牌 and none before", () => {
    expect(waits(counts("123m456p789s1122z"))).toEqual(kinds("12z"))
    expect(waits(counts("2345678m333p555s"))).toEqual(kinds("258m"))
    expect(waits(counts("19m19p19s1234567z"))).toHaveLength(13)
    expect(waits(counts("23467m345p56s88s3z"))).toEqual([])
  })
})
