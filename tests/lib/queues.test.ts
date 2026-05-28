import { describe, it, expect } from "vitest";
import { queuesForEntity, QUEUE_TYPE, PUBLIC_GROUP_TYPE } from "../../src/lib/queues";

describe("queuesForEntity", () => {
  const queues = [
    { developerName: "Closer_Pool", supportedEntities: "Lead" },
    { developerName: "CS_L1", supportedEntities: "Case,Task" },
    { developerName: "Generic_Group", supportedEntities: null },
    { developerName: "Five9", supportedEntities: "Lead, Call" }, // whitespace tolerated
  ];

  it("filters to queues that include the entity", () => {
    const r = queuesForEntity(queues, "Lead");
    expect(r.map((q) => q.developerName)).toEqual(["Closer_Pool", "Five9"]);
  });

  it("trims whitespace in the CSV", () => {
    const r = queuesForEntity(queues, "Call");
    expect(r.map((q) => q.developerName)).toEqual(["Five9"]);
  });

  it("returns empty when no queue supports the entity", () => {
    const r = queuesForEntity(queues, "Opportunity");
    expect(r).toEqual([]);
  });

  it("ignores queues with null supportedEntities", () => {
    const r = queuesForEntity(queues, "Lead");
    expect(r.find((q) => q.developerName === "Generic_Group")).toBeUndefined();
  });
});

describe("queue type constants", () => {
  it("exports the canonical string values", () => {
    expect(QUEUE_TYPE).toBe("QUEUE");
    expect(PUBLIC_GROUP_TYPE).toBe("PUBLIC_GROUP");
  });
});
