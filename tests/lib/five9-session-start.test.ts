import { describe, it, expect } from "vitest";
import { buildSessionStartBody } from "../../src/lib/five9/agent-api";

describe("buildSessionStartBody", () => {
  it("PSTN sends the phone number as stationId", () => {
    expect(buildSessionStartBody("PSTN", "+19045551234")).toEqual({
      stationId: "+19045551234",
      stationType: "PSTN",
    });
  });
  it("EMPTY sends an empty station (REST-only)", () => {
    expect(buildSessionStartBody("EMPTY", "")).toEqual({ stationId: "", stationType: "EMPTY" });
  });
  it("falls back to EMPTY for unknown types", () => {
    expect(buildSessionStartBody("WAT" as never, "x")).toEqual({ stationId: "", stationType: "EMPTY" });
  });
});
