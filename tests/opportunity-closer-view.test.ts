import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FieldGrid } from '@/components/slds/section';
import type { GridField } from '@/components/slds/section';
import { CLOSER_HIDDEN_FIELDS, closerOpportunityFields, closerOpportunitySnapshot, usesCloserOpportunityView } from '@/lib/opportunity-closer-view';

describe('closer opportunity layout', () => {
  it('uses the assigned closer role rather than the dialer flag or record owner', () => {
    expect(usesCloserOpportunityView({role:'SALES_REP',hierarchyRole:{name:'Closer',developerName:'Closer'}})).toBe(true);
    expect(usesCloserOpportunityView({role:'CLOSER'})).toBe(true);
    for (const role of ['ADMIN','MANAGER','SALES_REP','CS_REP','NEGOTIATOR']) expect(usesCloserOpportunityView({role})).toBe(false);
    expect(usesCloserOpportunityView(null)).toBe(false);
  });
  it('removes exactly the 17 marked labels and retains each remaining column', () => {
    const fields: GridField[] = [['Opportunity Name','Example'],['Opportunity Owner','Owner'],['Secured Party','Hidden'],['Lead Id','123'],['Processor','SAS'],['Dialer Group','Hidden']];
    expect(closerOpportunityFields(fields,true)).toEqual([['Opportunity Name','Example'],['Opportunity Owner','Owner'],['Processor','SAS'],['Lead Id','123']]);
    expect(CLOSER_HIDDEN_FIELDS).toHaveLength(17);
    const marked: GridField[] = CLOSER_HIDDEN_FIELDS.map(([label])=>[label,'value']);
    expect(closerOpportunityFields(marked,true)).toEqual([]);
    expect(closerOpportunityFields(fields,false)).toBe(fields);
  });
  it('removes marked source fields from All Fields without changing stored data or other views', () => {
    const data = Object.fromEntries(CLOSER_HIDDEN_FIELDS.flatMap(([, ...keys])=>keys.map(key=>[key,'hidden'])));
    const json = JSON.stringify({...data,Processor__c:'SAS',Opportunity_Reshuffled_DateTime__c:'2026-09-24'});
    expect(JSON.parse(closerOpportunitySnapshot(json,true)!)).toEqual({Processor__c:'SAS',Opportunity_Reshuffled_DateTime__c:'2026-09-24'});
    expect(closerOpportunitySnapshot(json,false)).toBe(json);
    expect(closerOpportunitySnapshot('{',true)).toBeNull();
  });
  it('renders the closer grid without marked labels while other roles retain them', () => {
    const fields: GridField[] = [['Opportunity Name','Example'], ['Processor','SAS'], ...CLOSER_HIDDEN_FIELDS.map(([label])=>[label,'Marked value'] as GridField)];
    const render = (closer: boolean) => renderToStaticMarkup(createElement(FieldGrid,{fields:closerOpportunityFields(fields,closer)}));
    const closer = render(true);
    expect(closer).toContain('Opportunity Name');
    expect(closer).toContain('Processor');
    expect(closer).not.toContain('Marked value');
    const standard = render(false);
    for (const [label] of CLOSER_HIDDEN_FIELDS) expect(standard).toContain(label);
  });
});
