import { Prisma } from '@/generated/prisma/client';
import type { LeadListDefinition } from './lead-list-catalog';

// The imported Lead_Source_Category__c formula. Derive it from current source so
// native edits cannot leave category lists stale and 7M JSON blobs need not be parsed.
const WEB_SOURCES = ["web", "phone inquiry", "partner referral", "other", "social", "google", "webform", "affiliate", "organic", "calendly", "bing", "reddit", "inbound call", "tb", "lawsuit", "google ads", "youtube", "organic m", "bullmarket", "ib - social", "ib-social", "ib - social spanish", "ib - google spanish", "ib - bing spanish", "ib - direct mail", "ib - youtube", "ib - bing", "ib-bing", "ib - google", "ib-google", "ib - debtco", "ib - organic m", "ib - outbrain", "ib - reddit", "website", "vibe ctv", "ib - <>", "tiktok"];
const json = (key: string) => Prisma.sql`(NULLIF(l."sfDataJson", '')::jsonb ->> ${key})`;
const nested = (key: string, field: string) => Prisma.sql`(NULLIF(l."sfDataJson", '')::jsonb -> ${key} ->> ${field})`;
const ownerName = Prisma.sql`COALESCE(u.name, ${json('Owner_Full_Name__c')}, ${nested('Owner', 'Name')})`;
const fields: Record<string, Prisma.Sql> = {
  'Lead Status': Prisma.sql`l.status`, 'Lead Source': Prisma.sql`l.source`,
  'Name': Prisma.sql`l."contactName"`, 'Created Date': Prisma.sql`l."createdAt"`,
  'Last Modified Date': Prisma.sql`l."updatedAt"`,
  'Lead Source Category': json('Lead_Source_Category__c'),
  'Sub Disposition': json('Sub_Disposition__c'),
  'five9 Disposition': json('five9_Disposition__c'),
  'UTM Term': Prisma.sql`COALESCE(l."utmTerm", ${json('UTM_Term__c')})`,
  'Ad Click Id': Prisma.sql`COALESCE(l."adClickId", ${json('Ad_Click_Id__c')})`,
  'Lead Vendor Id Text': Prisma.sql`COALESCE(${json('Lead_Vendor_Id_Text__c')}, ${json('Lead_Vendor_ID_Text__c')}, l."leadVendorId")`,
  'Website': json('Website'),
  'Unread By Owner': Prisma.sql`CASE WHEN l."sfId" IS NULL THEN 'true' ELSE ${json('IsUnreadByOwner')} END`,
  // IDs and aliases verified in the org's User detail pages on 2026-09-18.
  'Created By Alias': Prisma.sql`COALESCE(${nested('CreatedBy', 'Alias')}, CASE left(${json('CreatedById')}, 15)
    WHEN '0058Y00000DE2LS' THEN 'bbizc' WHEN '0058Y00000DE2L8' THEN 'wlead'
    WHEN '005VO0000008yv3' THEN 'treye' WHEN '0058Y00000CELzc' THEN 'AMupp' END)`,
  'Owner Username': Prisma.sql`COALESCE(u.email, ${nested('Owner', 'Username')})`,
  'Owner First Name': Prisma.sql`COALESCE(split_part(${ownerName}, ' ', 1), ${nested('Owner', 'FirstName')})`,
  'Owner Last Name': Prisma.sql`COALESCE(regexp_replace(${ownerName}, '^.* ', ''), ${nested('Owner', 'LastName')})`,
  'Closer': json('Closer__c'),
  'Lead Record Type': Prisma.sql`COALESCE(${nested('RecordType', 'Name')}, CASE ${json('RecordTypeId')}
    WHEN '0128Y000001Z0JTQA0' THEN 'Business'
    WHEN '0128Y000001Z0JUQA0' THEN 'Consumer'
    WHEN '012VO000000ceNpYAI' THEN 'Pre Lead'
    WHEN '012VO000002NUlpYAG' THEN 'Pre Lead'
    ELSE CASE l."recordType" WHEN 'BUSINESS' THEN 'Business' WHEN 'PRE_LEAD' THEN 'Pre Lead' ELSE l."recordType" END END)`,
};
const and = (parts: Prisma.Sql[]) => parts.length ? Prisma.sql`(${Prisma.join(parts, ' AND ')})` : Prisma.sql`TRUE`;
const inValues = (field: Prisma.Sql, values: string[]) => values.length ? Prisma.sql`${field} IN (${Prisma.join(values)})` : Prisma.sql`FALSE`;

/** Compile only the shapes returned by recordScope('lead'). Unknown shapes fail closed. */
export function leadScopeSql(scope: Record<string, unknown>): Prisma.Sql {
  const conditions: Prisma.Sql[] = [];
  for (const [key, value] of Object.entries(scope)) {
    const field = key === 'id' ? Prisma.sql`l.id` : key === 'assignedToId' ? Prisma.sql`l."assignedToId"` : null;
    if (!field) throw new Error('Unsupported lead access scope');
    if (typeof value === 'string') conditions.push(Prisma.sql`${field} = ${value}`);
    else if (value && typeof value === 'object' && Object.keys(value).length === 1 && 'in' in value && Array.isArray(value.in) && value.in.every(v => typeof v === 'string')) {
      conditions.push(inValues(field, value.in));
    } else throw new Error('Unsupported lead access condition');
  }
  return and(conditions);
}

/** Eastern calendar boundaries, including DST. The org's lists use Eastern time. */
export function leadFilterSql(definition: string): Prisma.Sql {
  const match = definition.match(/^(.*?) (not equal to|equals|contains|greater than) (.*)$/);
  if (!match) throw new Error(`Unsupported lead filter: ${definition}`);
  const [, label, op, value] = match;
  if (label === 'Lead Source Category' && (op === 'equals' || op === 'not equal to')) {
    const category = value.toLowerCase();
    const isWeb = inValues(Prisma.sql`lower(l.source)`, WEB_SOURCES);
    const isMail = Prisma.sql`lower(l.source) = 'direct mail'`;
    const condition = category === 'web' ? isWeb : category === 'direct mail' ? isMail
      : category === 'list lead' ? Prisma.sql`NOT (${isWeb} OR ${isMail})` : Prisma.sql`FALSE`;
    return op === 'not equal to' ? Prisma.sql`NOT (${condition})` : condition;
  }
  const field = fields[label];
  if (!field) throw new Error(`Unsupported lead field: ${label}`);
  if (label === 'Created Date' || label === 'Last Modified Date') {
    const today = Prisma.sql`(CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York')::date`;
    const boundary = (offset: number) => Prisma.sql`(((${today} + ${offset}::int)::timestamp AT TIME ZONE 'America/New_York') AT TIME ZONE 'UTC')`;
    if (op === 'equals' && ['TODAY', 'YESTERDAY', 'LAST 7 DAYS'].includes(value)) {
      const start = value === 'YESTERDAY' ? -1 : value === 'LAST 7 DAYS' ? -7 : 0;
      const end = value === 'YESTERDAY' ? 0 : 1;
      return Prisma.sql`(${field} >= ${boundary(start)} AND ${field} < ${boundary(end)})`;
    }
    const date = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (op === 'greater than' && date) {
      const iso = `${date[3]}-${date[1].padStart(2,'0')}-${date[2].padStart(2,'0')}`;
      return Prisma.sql`${field} >= (((${iso}::date + 1)::timestamp AT TIME ZONE 'America/New_York') AT TIME ZONE 'UTC')`;
    }
    throw new Error('Unsupported date filter');
  }
  if (op === 'contains') return Prisma.sql`strpos(lower(COALESCE(${field}, '')), lower(${value})) > 0`;
  if (op !== 'equals' && op !== 'not equal to') throw new Error('Unsupported lead comparison');
  const values = value.split(',').map(s => s.trim().toLowerCase());
  const predicate = inValues(Prisma.sql`lower(COALESCE(${field}, ''))`, values);
  return op === 'not equal to' ? Prisma.sql`NOT (${predicate})` : predicate;
}

export interface LeadListQueryInput {
  definition: LeadListDefinition;
  scope: Record<string, unknown>;
  userId: string;
  recentIds: string[];
  search?: string;
  status?: string;
  source?: string;
  recordType?: string;
  assignedToId?: string;
  sort?: string;
  dir?: string;
}
export function leadListIdsQuery(input: LeadListQueryInput): Prisma.Sql {
  const {definition, userId, recentIds} = input;
  const conditions = [leadScopeSql(input.scope), ...definition.filters.map(leadFilterSql)];
  // Converted records remain reachable through history, not ordinary lead lists.
  if (definition.scope !== 'recent') conditions.push(Prisma.sql`(l."convertedAt" IS NULL AND l."convertedAccountId" IS NULL AND lower(l.status) NOT IN ('converted', 'enrolled'))`);
  if (definition.scope === 'my') conditions.push(Prisma.sql`l."assignedToId" = ${userId}`);
  if (definition.scope === 'recent') conditions.push(inValues(Prisma.sql`l.id`, recentIds));
  if (definition.scope === 'closer-pool') conditions.push(Prisma.sql`(left(${json('OwnerId')}, 15) = '00GVO000005sF0q' OR COALESCE(${nested('Owner', 'Name')}, ${json('Owner_Full_Name__c')}, u.name) = 'Closer Pool')`);
  if (definition.label === 'My Unread Leads') conditions.push(Prisma.sql`NOT EXISTS (SELECT 1 FROM "LeadViewHistory" vh WHERE vh."userId" = ${userId} AND vh."leadId" = l.id)`);
  if (input.search) {
    const terms = [Prisma.sql`l."contactName"`, Prisma.sql`l."businessName"`, Prisma.sql`l.phone`, Prisma.sql`l.email`].map(f=>Prisma.sql`strpos(lower(COALESCE(${f}, '')), lower(${input.search!})) > 0`);
    conditions.push(Prisma.sql`(${Prisma.join(terms, ' OR ')})`);
  }
  for (const [name, column] of [['status',Prisma.sql`l.status`],['source',Prisma.sql`l.source`],['recordType',Prisma.sql`l."recordType"`],['assignedToId',Prisma.sql`l."assignedToId"`]] as const) {
    if (input[name]) conditions.push(Prisma.sql`${column} = ${input[name]}`);
  }
  const sorts: Record<string, Prisma.Sql> = {name:Prisma.sql`l."contactName"`, phone:Prisma.sql`l.phone`,status:Prisma.sql`l.status`,source:Prisma.sql`l.source`,ownerFullName:Prisma.sql`u.name`,createdDate:Prisma.sql`l."createdAt"`,company:Prisma.sql`l."businessName"`,leadId:Prisma.sql`l."sfId"`};
  const sort = sorts[input.sort ?? ''] ?? (definition.label === 'Web Leads' ? sorts.createdDate : sorts.name);
  const dir = input.dir === 'desc' || (!input.sort && definition.label === 'Web Leads') ? Prisma.sql`DESC` : Prisma.sql`ASC`;
  return Prisma.sql`SELECT l.id FROM "Lead" l LEFT JOIN "User" u ON u.id = l."assignedToId"
    WHERE ${and(conditions)} ORDER BY ${sort} ${dir}, l.id ASC LIMIT 2001`;
}
