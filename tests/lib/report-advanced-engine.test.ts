import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/auth",()=>({auth:vi.fn()}));
const db = vi.hoisted(()=>({findMany:vi.fn(),rows:[] as Record<string,unknown>[]}));
vi.mock("@/lib/prisma",()=>{const client={opportunity:{findMany:db.findMany},opportunitySnapshot:{findMany:db.findMany},user:{findMany:vi.fn().mockResolvedValue([])}};return{prisma:{...client,$transaction:(fn:(tx:unknown)=>unknown)=>fn(client)}};});
vi.mock("@/lib/analytics-access",()=>({analyticsAccess:vi.fn(),analyticsScope:()=>({allowed:true}),redactAnalyticsRelations:async(rows:unknown[])=>rows}));
import {runReportWithAccess} from "@/lib/reports/runner";
import {reportPrefilter} from "@/lib/reports/prefilter";
import {getObjectMetadata} from "@/lib/reports/object-metadata";
const access={userId:"u",isAdmin:false,permissions:["Reports.View","Opportunity.View"],ownerIds:["u"]};
const base={objectType:"Opportunity",columns:["name","totalDebt"],filters:[],summarize:[{field:"totalDebt",kind:"sum" as const},{field:"totalDebt",kind:"avg" as const}],rowLimit:2};
beforeEach(()=>{vi.clearAllMocks();db.rows=[];db.findMany.mockImplementation(async({cursor,take})=>{const index=cursor?db.rows.findIndex(r=>r.id===cursor.id)+1:0;return db.rows.slice(index,index+take);});});
describe("complete report evaluation",()=>{
  it("streams beyond a page and keeps totals independent of detail limit",async()=>{
    db.rows=Array.from({length:1507},(_,i)=>({id:String(i).padStart(5,"0"),name:`Deal ${i}`,totalDebt:i%2?null:10,createdAt:new Date("2026-09-01")}));
    const result=await runReportWithAccess(base,access);
    expect(result).toMatchObject({rowCount:1507,displayedRowCount:2,totals:{totalDebt_sum:7540,totalDebt_avg:10},truncated:true});
    expect(db.findMany).toHaveBeenCalledTimes(2);
    expect(db.findMany.mock.calls[1][0].cursor).toEqual({id:"00999"});
    expect(db.findMany.mock.calls[0][0].where.AND).toContainEqual({allowed:true});
  });
  it("matches JSON OR branches without requiring both branches",async()=>{
    db.rows=[{id:"1",name:"A",stage:"Working",sfDataJson:JSON.stringify({LeadSource:"Referral"})},{id:"2",name:"B",stage:"Other",sfDataJson:JSON.stringify({LeadSource:"Web"})},{id:"3",name:"C",stage:"Other",sfDataJson:JSON.stringify({LeadSource:"Other"})}];
    const result=await runReportWithAccess({...base,filters:[{field:"stage",operator:"equals",value:"Working",orGroup:"a"},{field:"sfDataJson.LeadSource",operator:"equals",value:"Web",orGroup:"b"}]},access);
    expect(result).toMatchObject({rowCount:2});
    expect(reportPrefilter([{field:"stage",operator:"equals",value:"Working",orGroup:"a"},{field:"sfDataJson.LeadSource",operator:"equals",value:"Web",orGroup:"b"}],new Map(getObjectMetadata("Opportunity")!.fields.map(f=>[f.key,f])))).toEqual({AND:[]});
  });
  it("calculates three grouping levels, parent subtotals and a ratio of totals",async()=>{
    db.rows=[{id:"1",name:"A",stage:"Working",totalDebt:100,amount:50,createdAt:new Date("2026-09-01"),assignedTo:{id:"u",name:"Owner"}},{id:"2",name:"B",stage:"Working",totalDebt:900,amount:90,createdAt:new Date("2026-09-02"),assignedTo:{id:"u",name:"Owner"}}];
    const result=await runReportWithAccess({...base,options:{groups:[{field:"assignedTo.name",interval:"value"},{field:"stage",interval:"value"},{field:"createdAt",interval:"month"}]},formulas:[{key:"formula_ratio",label:"Ratio",scope:"summary",operator:"percent",left:"amount_sum",right:"totalDebt_sum"}]},access);
    expect(result).toMatchObject({totals:{formula_ratio:expect.closeTo(14)},groups:[{path:["Owner","Working","2026-09"],count:2,summary:{formula_ratio:expect.closeTo(14)}}],groupSubtotals:[{path:["Owner"],count:2},{path:["Owner","Working"],count:2}]});
  });
  it("sorts detail previews across pages while keeping complete group counts",async()=>{
    db.rows=Array.from({length:1005},(_,i)=>({id:String(i).padStart(5,"0"),name:`D${i}`,totalDebt:i,stage:"Working"}));
    const result=await runReportWithAccess({...base,sortBy:"totalDebt",sortDir:"desc",groupBy:"stage"},access);
    if("error"in result)throw Error(result.error);
    expect(result.rows.map(r=>r.totalDebt)).toEqual([1004,1003]);expect(result.groups?.[0].count).toBe(1005);expect(result.groups?.[0].rows).toHaveLength(2);
  });
  it("rejects unknown filters instead of returning silently broadened totals",async()=>{
    expect(await runReportWithAccess({...base,filters:[{field:"notAField",operator:"equals",value:"secret"}]},access)).toHaveProperty("error");expect(db.findMany).not.toHaveBeenCalled();
  });
  it("changes the snapshot access fingerprint when matching record membership changes",async()=>{
    db.rows=[{id:"1",totalDebt:100}];const first=await runReportWithAccess(base,access);db.rows=[{id:"2",totalDebt:100}];const second=await runReportWithAccess(base,access);
    if("error"in first||"error"in second)throw Error("Unexpected error");expect(first.scopeHash).not.toBe(second.scopeHash);
  });
});
