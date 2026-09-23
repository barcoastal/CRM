import { expect,it,vi } from "vitest";
vi.mock("@/lib/auth",()=>({auth:vi.fn()}));
vi.mock("@/lib/prisma",()=>({prisma:{user:{findMany:vi.fn().mockResolvedValue([{id:"manager",managerId:null},{id:"agent",managerId:"manager"},{id:"other",managerId:null}])}}}));
import {runtimeWhere,runtimeFiltersSchema} from "@/lib/reports/runtime-filters";
it("uses an inclusive date end and expands only the selected reporting team",async()=>{
  expect(await runtimeWhere("opportunity",{from:"2026-09-01",to:"2026-09-30",ownerId:"manager",includeTeam:true})).toEqual({AND:[{createdAt:{gte:new Date("2026-09-01"),lt:new Date("2026-10-01")}},{assignedToId:{in:["manager","agent"]}}]});
});
it("maps related payment owners and history dates",async()=>{
  expect(await runtimeWhere("payment",{ownerId:"agent"})).toEqual({AND:[{client:{opportunity:{assignedToId:{in:["agent"]}}}}]});
  expect(await runtimeWhere("opportunitySnapshot",{from:"2026-09-01"})).toEqual({AND:[{capturedAt:{gte:new Date("2026-09-01")}}]});
});
it("rejects inverted dates",()=>expect(runtimeFiltersSchema.safeParse({from:"2026-10-01",to:"2026-09-01"}).success).toBe(false));
