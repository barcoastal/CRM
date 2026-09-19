import type { ListFilter } from './list-views';
const fields:Record<string,Set<string>>={
 Lead:new Set(['status','source','recordType','assignedToId','contactName','businessName','state','email','phone']),
 Account:new Set(['name','recordType','ownerId','clientStatus','stage','billingState','phone','email']),
 Opportunity:new Set(['name','recordType','assignedToId','stage','source']),
};
/** User-authored list criteria cannot inject relation or authorization clauses. */
export function listViewFilterError(entity:string,filters:ListFilter[]):string|null {
 if(!fields[entity])return null;
 for(const f of filters){
  if(!fields[entity].has(f.field))return `Unsupported filter field: ${f.field}`;
  if(!['EQ','NEQ','CONTAINS','NOT_CONTAINS','STARTS_WITH','IN','NOT_IN','IS_NULL','IS_NOT_NULL'].includes(f.op))return `Unsupported filter operation: ${f.op}`;
  if(['IS_NULL','IS_NOT_NULL'].includes(f.op))continue;
  if(['IN','NOT_IN'].includes(f.op)){if(!Array.isArray(f.value)||f.value.length>100||!f.value.every(v=>typeof v==='string'))return 'Choose a list of text values';}
  else if(typeof f.value!=='string'||f.value.length>2000)return 'Filter values must be text';
 }
 return null;
}
export function mayReadListView(view:{isSystem:boolean;isShared:boolean;ownerId:string|null},userId:string){return view.isSystem||view.isShared||view.ownerId===userId;}
export function mayEditListView(view:{isSystem:boolean;ownerId:string|null},userId:string){return !view.isSystem&&view.ownerId===userId;}
