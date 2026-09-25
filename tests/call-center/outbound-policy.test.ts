import { describe, expect, it } from "vitest";
import {
  coldCapacity,
  machineAnswer,
  webDeadline,
  webSla,
} from "@/lib/call-center/outbound-policy";
const capacity = {
  readyAgents: 3,
  maxLines: 10,
  lineScope: "TEAM",
  inFlight: 0,
  attempts: 0,
  answered: 0,
  abandoned: 0,
  priorityWaiting: false,
};
describe("web lead first-attempt deadline", () => {
  const received = new Date("2026-09-24T14:00:00Z");
  it("sets the deadline sixty seconds after CRM receipt", () =>
    expect(webDeadline(received).toISOString()).toBe(
      "2026-09-24T14:01:00.000Z",
    ));
  it("reports an uncalled lead overdue without pretending it was called", () =>
    expect(webSla(received, null, new Date("2026-09-24T14:01:01Z"))).toEqual({
      seconds: 0,
      missed: true,
      attempted: false,
    }));
  it("stops the SLA clock at the provider's first attempt", () =>
    expect(
      webSla(
        received,
        new Date("2026-09-24T14:00:25Z"),
        new Date("2026-09-25T14:00:00Z"),
      ),
    ).toEqual({ seconds: 35, missed: false, attempted: true }));
  it("treats a call starting at sixty seconds as on time", () =>
    expect(webSla(received, webDeadline(received)).missed).toBe(false));
});
describe("team parallel dialing", () => {
  it("limits the whole team to ten, not ten per agent", () =>
    expect(coldCapacity(capacity)).toBe(10));
  it("supports more than ten concurrent lines", () =>
    expect(coldCapacity({ ...capacity, maxLines: 25 })).toBe(25));
  it("counts queued and ringing attempts against the limit", () =>
    expect(coldCapacity({ ...capacity, inFlight: 8 })).toBe(2));
  it("does not launch calls without a ready audio seat", () =>
    expect(coldCapacity({ ...capacity, readyAgents: 0 })).toBe(0));
  it("gives priority leads capacity before cold lists", () =>
    expect(coldCapacity({ ...capacity, priorityWaiting: true })).toBe(0));
  it("reduces pacing when more people pick up", () =>
    expect(coldCapacity({ ...capacity, attempts: 40, answered: 20 })).toBe(6));
  it("stops after an initial missed agent connection", () =>
    expect(
      coldCapacity({ ...capacity, attempts: 10, answered: 2, abandoned: 1 }),
    ).toBe(0));
  it("does not hang up merely because detection is uncertain", () => {
    expect(machineAnswer("unknown")).toBe(false);
    expect(machineAnswer("human")).toBe(false);
    expect(machineAnswer("machine_start")).toBe(true);
    expect(machineAnswer("fax")).toBe(true);
  });
});
