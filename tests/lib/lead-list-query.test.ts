import { describe, it, expect } from 'vitest';
import { LEAD_LIST_VIEWS } from '../../src/lib/lead-list-catalog';
import { leadFilterSql, leadScopeSql, leadListIdsQuery } from '../../src/lib/lead-list-query';

describe('audited lead list definitions',()=>{
  it('contains 57 unique options and compiles every saved filter',()=>{
    expect(LEAD_LIST_VIEWS).toHaveLength(57);
    expect(new Set(LEAD_LIST_VIEWS.map(v=>v.value)).size).toBe(57);
    for(const view of LEAD_LIST_VIEWS) expect(()=>leadListIdsQuery({definition:view,scope:{assignedToId:{in:['rep']}},userId:'rep',recentIds:[]})).not.toThrow();
  });
  it('preserves owner exceptions and the actual survey criteria',()=>{
    const byName=(name:string)=>LEAD_LIST_VIEWS.find(v=>v.label===name)!;
    expect(byName('Chris David Leads').filters).toContain('Owner First Name equals Christopher');
    expect(byName('David Medina Leads').filters.some(f=>f.startsWith('Owner First Name'))).toBe(false);
    for(const name of ['Evgeny Nozdrin','Joe Mcdonald','Jovana Pavlovic']) expect(byName(`${name} Leads`).filters).toContain(`Closer equals ${name}`);
    expect(byName('Leads for Survey').filters).toContain('Lead Status equals Archive Disposition');
  });
});
describe('lead query authorization and filters',()=>{
  it('fails closed for empty and unknown access scopes',()=>{
    expect(leadScopeSql({id:{in:[]}}).text).toContain('FALSE');
    expect(()=>leadScopeSql({OR:[{}]})).toThrow();
    expect(()=>leadScopeSql({assignedToId:{in:['rep'],not:'other'}})).toThrow();
  });
  it('ANDs search and saved filters with permissions, binding hostile input',()=>{
    const q=leadListIdsQuery({definition:LEAD_LIST_VIEWS.find(v=>v.value==='my-leads')!,scope:{assignedToId:{in:['allowed']}},userId:'me',recentIds:[],search:"x' OR TRUE --",status:'Working Lead'});
    expect(q.text).not.toContain("x' OR TRUE --");
    expect(q.values).toContain("%x' OR TRUE --%");
    expect(q.values).toContain('allowed');expect(q.values).toContain('me');
    expect(q.values).toContain('Working Lead');expect(q.values).toContain('archive disposition');
    expect(q.text).toContain(' AND ');
  });
  it('treats blank and negative filters as null-safe comparisons',()=>{
    const q=leadFilterSql('Ad Click Id equals ');expect(q.values).toContain('');expect(q.text).toContain('COALESCE');
    expect(leadFilterSql('Sub Disposition not equal to Fake Lead, Fake Leads').text).toContain('NOT (');
  });
  it('uses Eastern calendar dates rather than a rolling 24 hours',()=>{
    const q=leadFilterSql('Created Date equals YESTERDAY');expect(q.text).toContain('America/New_York');expect(q.values).toContain(-1);expect(q.values).toContain(0);
    expect(leadFilterSql('Created Date greater than 8/10/2025').values).toContain('2025-08-10');
  });
  it('never silently ignores an unsupported filter',()=>{
    expect(()=>leadFilterSql('Anything equals x')).toThrow();expect(()=>leadFilterSql('Lead Status greater than New')).toThrow();
  });
  it('starts recent lists empty and excludes opened records from unread',()=>{
    const recent=leadListIdsQuery({definition:LEAD_LIST_VIEWS.find(v=>v.value==='recent')!,scope:{},userId:'me',recentIds:[]});expect(recent.text).toContain('FALSE');
    const unread=leadListIdsQuery({definition:LEAD_LIST_VIEWS.find(v=>v.value==='my-unread-leads')!,scope:{},userId:'me',recentIds:['viewed']});expect(unread.values).toContain('me');expect(unread.text).toContain('NOT EXISTS');expect(unread.text).toContain('LeadViewHistory');
  });
});
