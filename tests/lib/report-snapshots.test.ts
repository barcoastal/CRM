import {beforeEach,expect,it,vi} from "vitest";
const db=vi.hoisted(()=>({access:vi.fn(),report:vi.fn(),run:vi.fn()}));
vi.mock("@/lib/prisma",()=>({prisma:{report:{findFirst:db.report}}}));
vi.mock("@/lib/analytics-access",()=>({analyticsAccessForUser:db.access}));
vi.mock("@/lib/permissions",()=>({hasPermission:(p:string[],key:string)=>p.includes(key)}));
vi.mock("@/lib/reports/runner",()=>({runReportWithAccess:db.run}));
import {canReadSnapshot,createReportSnapshot,snapshotAttachments,summaryCsv} from "@/lib/reports/snapshots";
const result={columns:[{key:"name",label:"Name"}],rows:[{name:"Example"}],rowCount:500,scopeHash:"same",totals:{_count:500,totalDebt_sum:1000}};
const config={objectType:"Opportunity",columns:["name"],filters:[],summarize:[],rowLimit:1};
beforeEach(()=>{vi.clearAllMocks();db.access.mockResolvedValue({userId:"u",isAdmin:false,permissions:["Reports.View","Reports.Export"],ownerIds:["u"]});db.report.mockResolvedValue(config);db.run.mockResolvedValue(result);});
it("saves authorized generated results and produces summary/detail attachments",async()=>{
 const snapshot=await createReportSnapshot("r","u");const files=snapshotAttachments(snapshot);expect(files.map(f=>f.filename)).toEqual(["report-summary.csv","report-details.csv"]);expect(Buffer.from(files[0].content,"base64").toString()).toContain('"500"');expect(summaryCsv(result)).toContain('"1000"');
});
it("denies snapshots when matching access membership changes",async()=>{
 expect(await canReadSnapshot({config,result},"u")).toBe(true);db.run.mockResolvedValue({...result,scopeHash:"different"});expect(await canReadSnapshot({config,result},"u")).toBe(false);
});
it("requires export permission for snapshot creation and retrieval",async()=>{
 db.access.mockResolvedValue({userId:"u",isAdmin:false,permissions:["Reports.View"],ownerIds:["u"]});await expect(createReportSnapshot("r","u")).rejects.toThrow("export");expect(await canReadSnapshot({config,result},"u")).toBe(false);expect(db.run).not.toHaveBeenCalled();
});
it("does not save partial/error results",async()=>{
 db.run.mockResolvedValue({error:"Report timed out"});await expect(createReportSnapshot("r","u")).rejects.toThrow("timed out");
});
