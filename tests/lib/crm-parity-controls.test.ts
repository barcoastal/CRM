import {describe,it,expect,vi} from 'vitest';
import {parseLeadCsv} from '../../src/lib/lead-csv';
import {importedCloserId,syncAccountCloser} from '../../src/lib/account-team';
import {savedLeadFilterSql,leadListIdsQuery} from '../../src/lib/lead-list-query';
import {LEAD_LIST_VIEWS} from '../../src/lib/lead-list-catalog';
import {expandRelationshipFields,missingSourceFields,LEAD_PARITY_FIELDS,sourceValueMatches} from '../../src/lib/sf-sync/lead-fields';
import type {TriggerCtx} from '../../src/lib/triggers/types';
describe('CSV import preview',()=>{
 it('handles commas, escaped quotes, CRLF and multiline quoted values',()=>{const rows=parseLeadCsv('Name,Company,Phone\r\n"Sam ""S"" Smith","ACME, Inc\nEast",5551234567');expect(rows).toEqual([{contactName:'Sam "S" Smith',businessName:'ACME, Inc\nEast',phone:'5551234567'}]);});
 it('rejects malformed rows and ambiguous headers',()=>{expect(()=>parseLeadCsv('Name,Company,Phone\nSam,Acme')).toThrow('expected 3');expect(()=>parseLeadCsv('Name,Company,Phone\n"Sam,Acme,123')).toThrow('Unclosed');expect(()=>parseLeadCsv('Name,Name,Phone\nA,B,123')).toThrow();});
});
describe('saved lead views preserve access scope',()=>{
 it('binds user values and ANDs them with scope and base filters',()=>{const q=leadListIdsQuery({definition:LEAD_LIST_VIEWS.find(v=>v.value==='web-leads')!,scope:{assignedToId:'allowed'},userId:'allowed',recentIds:[],savedFilters:[{field:'status',op:'EQ',value:"x' OR true --"}]});expect(q.text).not.toContain("x' OR true --");expect(q.values).toContain('allowed');expect(q.values).toContain("x' OR true --");});
 it('rejects arbitrary field and operator expressions',()=>{expect(()=>savedLeadFilterSql({field:'OR',op:'EQ',value:{}})).toThrow();expect(()=>savedLeadFilterSql({field:'status',op:'OR',value:[]})).toThrow();});
});
describe('account closer membership',()=>{
 it('does not resolve ambiguous names or malformed snapshots',()=>{expect(importedCloserId('invalid')).toBeNull();expect(importedCloserId('{"Closer__c":1}')).toBeNull();});
 it('removes only old automatically maintained entries and preserves manual memberships',async()=>{const db={user:{findFirst:vi.fn().mockResolvedValue({id:'new'})},accountTeamMember:{deleteMany:vi.fn(),upsert:vi.fn()}};await syncAccountCloser(db as unknown as TriggerCtx['prisma'],{id:'acct',sfDataJson:'{"Closer__c":"005abc"}'});expect(db.user.findFirst.mock.calls[0][0].where.OR).toEqual([{id:'005abc'},{sfId:'005abc'}]);expect(db.accountTeamMember.deleteMany).toHaveBeenCalledWith({where:{accountId:'acct',source:'CLOSER_SYNC',userId:{not:'new'}}});expect(db.accountTeamMember.upsert.mock.calls[0][0].update).toEqual({});});
 it('revokes automatic access when closer is cleared or unmapped',async()=>{const db={user:{findFirst:vi.fn()},accountTeamMember:{deleteMany:vi.fn(),upsert:vi.fn()}};await syncAccountCloser(db as unknown as TriggerCtx['prisma'],{id:'acct',sfDataJson:null});expect(db.accountTeamMember.deleteMany).toHaveBeenCalledWith({where:{accountId:'acct',source:'CLOSER_SYNC'}});expect(db.accountTeamMember.upsert).not.toHaveBeenCalled();});
});
describe('import completeness',()=>{
 it('ignores CSV transport differences but preserves real conflicts',()=>{expect(sourceValueMatches('false',false)).toBe(true);expect(sourceValueMatches('1.0',1)).toBe(true);expect(sourceValueMatches({Name:'Sam'},{Name:'Sam',attributes:{url:'source'}})).toBe(true);expect(sourceValueMatches('true',false)).toBe(false);expect(sourceValueMatches(null,0)).toBe(false);});
 it('retains owner relation fields read by lists',()=>{expect(expandRelationshipFields({'Owner.Alias':'sam','Owner.Name':'Sam'}).Owner).toEqual({Alias:'sam',Name:'Sam'});});
 it('repairs absent keys without overwriting false or null values',()=>{expect(missingSourceFields({a:false,b:null},{a:true,b:'value',c:false,attributes:{}})).toEqual(['c']);});
 it('exports readable health inputs and owner fields',()=>{expect(LEAD_PARITY_FIELDS).not.toContain('Is_Payment_Amount_Populated__c');expect(LEAD_PARITY_FIELDS).toContain('Creditor_10_Payment__c');expect(LEAD_PARITY_FIELDS).toContain('Current_Total_Debt_Amount__c');expect(LEAD_PARITY_FIELDS).toContain('Owner.Alias');});
});

import {mayReadListView,mayEditListView,listViewFilterError} from '../../src/lib/list-view-access';
describe('saved view access',()=>{
 it('shared views are readable but only owners can edit; system views are immutable',()=>{const view={isSystem:false,isShared:true,ownerId:'owner'};expect(mayReadListView(view,'other')).toBe(true);expect(mayEditListView(view,'other')).toBe(false);expect(mayEditListView(view,'owner')).toBe(true);expect(mayReadListView({...view,isShared:false},'other')).toBe(false);expect(mayEditListView({...view,isSystem:true},'owner')).toBe(false);});
 it('rejects filter relation injection before storing views',()=>{expect(listViewFilterError('Account',[{field:'OR',op:'EQ',value:[{}]}])).toBeTruthy();expect(listViewFilterError('Lead',[{field:'status',op:'EQ',value:'Working Lead'}])).toBeNull();});
});

import { LEAD_COLUMNS, LEAD_COLUMN_LAYOUTS, leadColumnsForView } from '../../src/lib/lead-list-columns';
describe('audited lead column layouts',()=>{
 it('keeps recent, all, and personal layouts distinct',()=>{
  expect(leadColumnsForView('All Leads')).toEqual(['name','email','company','state','status','unread','createdDate','ownerAlias']);
  expect(leadColumnsForView('Recently Viewed')).toHaveLength(10);
  expect(leadColumnsForView('My Leads')).toHaveLength(15);
  expect(leadColumnsForView('My Leads').at(-1)).toBe('firstEmail');
 });
 it('renders every configured field exactly once with the record name first',()=>{
  const keys=new Set(LEAD_COLUMNS.map(c=>c.key));
  for(const label of Object.keys(LEAD_COLUMN_LAYOUTS)){
   const layout=leadColumnsForView(label);
   expect(layout[0]).toBe('name');
   expect(new Set(layout).size).toBe(layout.length);
   expect(layout.every(key=>keys.has(key))).toBe(true);
  }
 });
});
