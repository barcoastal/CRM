import type { GridField } from '@/components/slds/section';

/** Opportunity layout exclusions explicitly marked in the closer screenshots. */
export const CLOSER_HIDDEN_FIELDS = [
  ['Secured Party', 'Secured_Party__c'],
  ['Call ASAP', 'Call_ASAP__c'],
  ['Business Start Date', 'Business_Start_Date__c'],
  ['Hopper Priority', 'Hopper_priority_c__c', 'Hopper_Priority__c'],
  ['Outbound ANI Date', 'Outbound_ANI_Date__c'],
  ['Outbound ANI From', 'Outbound_ANI_From__c'],
  ['Outbound ANI Identifier', 'Outbound_ANI_Identifier__c'],
  ['Dialer Group', 'Dialer_Group__c'],
  ['Re-shuffle Opportunity', 'Re_shuffle_Opportunity__c'],
  ['Re-shuffle count', 'Re_shuffle_count__c'],
  ['Processor Contract Formula', 'Processor_Contract_Formula__c'],
  ['Ad Click Id', 'Ad_Click_Id__c'],
  ['Opportunity Record Type', 'RecordType', 'RecordTypeId', 'Opportunity_Record_Type__c'],
  ['Affiliate', 'Affiliate__c'],
  ['Eli Ad click', 'Eli_Ad_click__c', 'Eli_Ad_Click__c'],
  ['Has Closer Notes', 'Has_Closer_Notes__c'],
  ['Latest Closer Notes', 'Latest_Closer_Notes__c'],
] as const;

export function usesCloserOpportunityView(user: { role?: string; hierarchyRole?: { developerName: string; name: string } | null } | null) {
  return user?.role === 'CLOSER' || user?.hierarchyRole?.developerName === 'Closer' || user?.hierarchyRole?.name === 'Closer';
}

export function closerOpportunityFields(fields: GridField[], closer: boolean): GridField[] {
  if (!closer) return fields;
  const hidden = new Set<string>(CLOSER_HIDDEN_FIELDS.map(([label]) => label));
  // Keep each surviving field in its original column and close the gaps.
  const columns = [0, 1].map(column => fields.filter((field, index) => index % 2 === column && field[0] && !hidden.has(field[0])));
  return Array.from({ length: Math.max(...columns.map(column => column.length)) }, (_, index) =>
    [columns[0][index] ?? ['', null], columns[1][index] ?? ['', null]] as GridField[]).flat();
}

export function closerOpportunitySnapshot(json: string | null, closer: boolean): string | null {
  if (!closer || !json) return json;
  try {
    const data = JSON.parse(json);
    for (const [, ...keys] of CLOSER_HIDDEN_FIELDS) for (const key of keys) delete data[key];
    return JSON.stringify(data);
  } catch { return null; }
}
