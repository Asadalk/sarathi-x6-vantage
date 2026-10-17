import { describe, expect, it } from "vitest";
import { conservativeScenario, decodeScenario, defaultScenario, encodeScenario } from "@/lib/scenario";

describe("shareable scenario URLs", () => {
  it("default scenario encodes to an empty query string", () => {
    expect(encodeScenario(defaultScenario())).toBe("");
  });
  it("round-trips inputs, per-powertrain overrides and VANTAGE mode", () => {
    const s = conservativeScenario();
    s.vantage = "all";
    s.inputs.kmPerDay = 240;
    const back = decodeScenario(encodeScenario(s));
    expect(back.inputs).toEqual(s.inputs);
    expect(back.specs.EREV).toEqual(s.specs.EREV);
    expect(back.vantage).toBe("all");
  });
  it("ignores unknown keys and non-numeric values", () => {
    const s = decodeScenario("foo=1&kmPerDay=abc&EREV.why=x&vantage=bogus");
    expect(s).toEqual(defaultScenario());
  });
});
