import { expect, it, vi } from "vitest";
const find=vi.hoisted(()=>vi.fn());
vi.mock("@/lib/prisma",()=>({prisma:{opportunity:{findUnique:find}}}));
vi.mock("@/lib/creditor-agreements",()=>({resolveAgreement:()=>"Citadel"}));
import { planPacket } from "@/lib/contracts/routing";
it.each([true,false])("carries the opportunity's addendum requirement into the generated packet (%s)",async(required)=>{
  find.mockResolvedValue({addendumRequired:required,account:{paymentProcessor:"SAS"},debts:[]});
  const plan=await planPacket("test");
  expect(plan.categories).toEqual(required ? ["COASTAL","ADDENDUM","PROCESSOR_SAS","LEGAL_CITADEL"] : ["COASTAL","PROCESSOR_SAS","LEGAL_CITADEL"]);
});
