import {beforeAll,afterAll,describe,it,expect} from 'vitest';
// @ts-expect-error The installed pg package does not include TypeScript declarations.
import {Client} from 'pg';
import {LEAD_LIST_VIEWS} from '../../src/lib/lead-list-catalog';
import {leadListIdsQuery, type LeadListQueryInput} from '../../src/lib/lead-list-query';

// Uses session-local temporary tables only; never reads or writes CRM tables.
describe.skipIf(!process.env.LEAD_LIST_TEST_DATABASE_URL)('lead views in PostgreSQL',()=>{
  const db=new Client({connectionString:process.env.LEAD_LIST_TEST_DATABASE_URL});
  beforeAll(async()=>{
    await db.connect();
    await db.query(`CREATE TEMP TABLE "LeadViewHistory" ("userId" text, "leadId" text);
      CREATE TEMP TABLE "User" (id text, name text, email text, "sfId" text);
      CREATE TEMP TABLE "Lead" (id text, "sfId" text,"assignedToId" text,"sfDataJson" text,status text,source text,"recordType" text,"contactName" text,"businessName" text,phone text,email text,"adClickId" text,"utmTerm" text,"leadVendorId" text,"createdAt" timestamp,"updatedAt" timestamp,"convertedAt" timestamp,"convertedAccountId" text);
      INSERT INTO "User" VALUES ('allowed','Christopher David','david@example.test','005example'),('other','Other Owner','other@example.test','005other');`);
    const rows=[
      ['a','allowed','New','Web',{Lead_Source_Category__c:'Web',IsUnreadByOwner:true,CreatedBy:{Alias:'bbizc'},RecordTypeId:'0128Y000001Z0JTQA0'}],
      ['b','other','New','Web',{Lead_Source_Category__c:'Web',IsUnreadByOwner:true}],
      ['c','allowed','Archive Disposition','Direct Mail',{Sub_Disposition__c:'Bad State'}],
      ['d','allowed','New','LawSuit',{Closer__c:'Evgeny Nozdrin'}],
      ['e','allowed','Converted','Web',{}],
    ];
    for(const [id,owner,status,source,data] of rows) await db.query(`INSERT INTO "Lead" (id,"assignedToId",status,source,"sfDataJson","contactName","businessName","recordType","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$1,'Business','BUSINESS',now() AT TIME ZONE 'UTC',now() AT TIME ZONE 'UTC')`,[id,owner,status,source,JSON.stringify(data)]);
    await db.query(`UPDATE "Lead" SET "sfId" = id`);
  });
  afterAll(async()=>{await db.end();});
  async function ids(label:string,overrides:Partial<LeadListQueryInput>={}){
    const q=leadListIdsQuery({definition:LEAD_LIST_VIEWS.find(v=>v.label===label)!,scope:{assignedToId:{in:['allowed']}},userId:'allowed',recentIds:[],...overrides});
    return (await db.query(q.text,q.values)).rows.map((r:{id:string})=>r.id);
  }
  it('executes all 57 definitions as valid SQL',async()=>{for(const v of LEAD_LIST_VIEWS)await ids(v.label);});
  it('enforces owner access on all, web, recent, and search views',async()=>{
    expect(await ids('All Leads')).toEqual(['a','c','d']);
    expect(await ids('Web Leads')).toEqual(['d','a']);
    expect(await ids('Recently Viewed',{recentIds:['a','b','e']})).toEqual(['a','e']);
    expect(await ids('All Leads',{search:'b'})).toEqual(['a','c','d']); // business name matches, but never unauthorized b
    expect(await ids('All Leads',{scope:{id:{in:[]}}})).toEqual([]);
  });
  it('applies real source, archived, closer and owner criteria',async()=>{
    expect(await ids('Chris David Leads')).toEqual(['a','d']);
    expect(await ids('Evgeny Nozdrin Leads')).toEqual(['d']);
    expect(await ids('Copy of Web Leads - Archived')).toEqual(['c']);
    expect(await ids('Todays Web Leads')).toEqual(['a']);
    expect(await ids('Lawsuit Leads')).toEqual(['d']);
  });
  it('handles blank click IDs and unread history',async()=>{
    expect(await ids('NO Ad Click Ids')).toEqual(['a','d']);
    expect(await ids('My Unread Leads')).toEqual(['a']);
    await db.query(`INSERT INTO "LeadViewHistory" VALUES ('allowed','a')`);
    expect(await ids('My Unread Leads')).toEqual([]);
  });
  it('keeps search inside the selected list and parameterizes input',async()=>{
    expect(await ids('Web Leads',{search:'c'})).toEqual([]);
    expect(await ids('All Leads',{search:"' OR TRUE --"})).toEqual([]);
    expect(await ids('All Leads',{status:'Archive Disposition'})).toEqual(['c']);
  });
  it('pages without gaps and counts without changing view membership',async()=>{
    const input={definition:LEAD_LIST_VIEWS.find(v=>v.value==='web-leads')!,scope:{assignedToId:'allowed'},userId:'allowed',recentIds:[]};
    const run=async(options:Parameters<typeof leadListIdsQuery>[1])=>{const q=leadListIdsQuery(input,options);return (await db.query(q.text,q.values)).rows.map((r:{id:string})=>r.id);};
    const first=await run({limit:1,offset:0});
    const second=await run({limit:1,offset:1});
    expect([...first,...second]).toEqual(await ids('Web Leads'));
    expect(new Set(await run({ordered:false}))).toEqual(new Set([...first,...second]));
  });
  it('treats search wildcards literally while matching case insensitively',async()=>{
    await db.query(`UPDATE "Lead" SET "businessName"='ACME 10%_off' WHERE id='a'`);
    expect(await ids('Web Leads',{search:'acme 10%_'})).toEqual(['a']);
    expect(await ids('Web Leads',{search:'%'})).toEqual(['a']);
    expect(await ids('Web Leads',{search:'10X'})).toEqual([]);
  });
});
