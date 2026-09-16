// Authorized temporary account test. Credentials stay in memory and are never logged.
const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const { randomUUID, randomBytes } = require('crypto');
const base = 'https://crm.coastaldebt-tools.com';
const tag = 'crm-access-test-' + randomUUID();
const ids = Object.fromEntries(['manager','agent','permissions','managerTask','agentTask','report','dashboard','tile'].map(key => [key, tag + '-' + key]));
const c = new Client({ connectionString: process.env.DATABASE_URL });
let assertions = 0;
function check(value, label) { if (!value) throw new Error('FAILED: ' + label); assertions++; console.log('PASS ' + label); }
function browserSession() {
  const jar = new Map();
  return async function request(path, method = 'GET', body, form = false) {
    const headers = { Cookie: [...jar].map(([k,v]) => k+'='+v).join('; '), Origin: base, Referer: base+'/login' };
    if (body !== undefined) headers['Content-Type'] = form ? 'application/x-www-form-urlencoded' : 'application/json';
    if (form) headers['X-Auth-Return-Redirect'] = '1';
    const r = await fetch(base+path, { method, headers, body: body === undefined ? undefined : form ? new URLSearchParams(body) : JSON.stringify(body), redirect: 'manual', signal: AbortSignal.timeout(45000) });
    for (const cookie of r.headers.getSetCookie()) { const pair=cookie.split(';')[0]; const i=pair.indexOf('='); jar.set(pair.slice(0,i),pair.slice(i+1)); }
    const text=await r.text(); let data; try { data=JSON.parse(text); } catch { data=null; }
    return { status: r.status, data };
  };
}
async function login(role, password) {
  const request=browserSession();
  const csrf=await request('/api/auth/csrf');
  check(!!csrf.data?.csrfToken, role+' gets normal login CSRF token');
  await request('/api/auth/callback/credentials','POST',{csrfToken:csrf.data.csrfToken,email:ids[role]+'@example.invalid',password,callbackUrl:base+'/dashboard'},true);
  const session=await request('/api/auth/session');
  check(session.data?.user?.id === ids[role],role+' signs in through normal credentials flow');
  return request;
}
(async()=>{
 await c.connect();
 const password=randomBytes(32).toString('base64url'); const hash=await bcrypt.hash(password,12);
 try {
  await c.query('BEGIN');
  await c.query('INSERT INTO "PermissionSet" (id,name,label,"isCustom") VALUES ($1,$1,$2,true)',[ids.permissions,'Temporary CRM access verification']);
  for (const key of ['Reports.View','Reports.Edit','Dashboards.View','Dashboards.Create','Task.View']) await c.query('INSERT INTO "PermissionSetPermission" (id,"permissionSetId",key) VALUES ($1,$2,$3)',[randomUUID(),ids.permissions,key]);
  for (const role of ['manager','agent']) {
   await c.query('INSERT INTO "User" (id,name,email,"passwordHash",role,"isActive","updatedAt","managerId") VALUES ($1,$2,$3,$4,$5,true,now(),$6)',[ids[role],'TEMP CRM Access Test '+role,ids[role]+'@example.invalid',hash,role==='manager'?'MANAGER':'SALES_REP',role==='agent'?ids.manager:null]);
   await c.query('INSERT INTO "UserPermissionSet" (id,"userId","permissionSetId") VALUES ($1,$2,$3)',[randomUUID(),ids[role],ids.permissions]);
  }
  for (const role of ['manager','agent']) await c.query('INSERT INTO "Task" (id,subject,"ownerId","dueDate","updatedAt") VALUES ($1,$2,$3,now()-interval \'1 hour\',now())',[ids[role+'Task'],'TEMP ACCESS TEST '+role,ids[role]]);
  await c.query('INSERT INTO "Report" (id,name,"objectType",columns,"isShared","createdById","updatedAt") VALUES ($1,$2,\'Task\',$3::jsonb,false,$4,now())',[ids.report,'TEMP private access test',JSON.stringify(['id','subject']),ids.manager]);
  await c.query('INSERT INTO "Dashboard" (id,name,"isShared","createdById","updatedAt") VALUES ($1,$2,true,$3,now())',[ids.dashboard,'TEMP shared access test',ids.manager]);
  await c.query('INSERT INTO "DashboardTile" (id,"dashboardId",kind,title,"queryKey","updatedAt") VALUES ($1,$2,\'kpi\',\'TEMP test tile\',\'tasks.open_overdue\',now())',[ids.tile,ids.dashboard]);
  await c.query('COMMIT');
  console.log('Temporary synthetic fixture created; no customer records assigned or modified.');
  const agent=await login('agent',password), manager=await login('manager',password);
  const config={objectType:'Task',columns:['id','subject'],filters:[],rowLimit:20};
  const ar=await agent('/api/reports/run-adhoc','POST',config);
  check(ar.status===200 && ar.data.rows.length===1 && ar.data.rows[0].id===ids.agentTask,'agent report shows only agent task');
  const mr=await manager('/api/reports/run-adhoc','POST',config);
  check(mr.status===200 && mr.data.rows.length===2 && mr.data.rows.every(r=>[ids.agentTask,ids.managerTask].includes(r.id)),'manager report shows self and direct report only');
  const attack=await agent('/api/reports/run-adhoc','POST',{...config,filters:[{field:'id',operator:'equals',value:ids.managerTask,orGroup:'one'},{field:'id',operator:'equals',value:ids.agentTask,orGroup:'two'}]});
  check(attack.status===200 && attack.data.rows.length===1 && attack.data.rows[0].id===ids.agentTask,'OR filters cannot widen agent scope');
  for (const [label,request,expected] of [['agent',agent,1],['manager',manager,2]]) {
   const r=await request('/api/dashboards/tile-data','POST',{kind:'kpi',queryKey:'tasks.open_overdue'});
   check(r.status===200 && r.data.value===expected,label+' dashboard aggregate respects team scope');
  }
  check((await agent('/api/reports/'+ids.report)).status===404,'agent cannot open manager private report');
  const saved=await manager('/api/reports/'+ids.report+'/run','POST',{});
  check(saved.status===200 && saved.data.rows.length===2,'owner can run private saved report');
  check((await agent('/api/dashboards/'+ids.dashboard)).status===200,'shared dashboard is viewable');
  const tilePath='/api/dashboards/'+ids.dashboard+'/tiles/'+ids.tile;
  check((await agent(tilePath,'PATCH',{title:'SHOULD NEVER SAVE'})).status===404,'reader cannot edit shared dashboard tile');
  check((await agent(tilePath,'DELETE')).status===404,'reader cannot delete shared dashboard tile');
  check((await manager(tilePath,'PATCH',{title:'TEMP owner edit verified'})).status===200,'owner can edit own dashboard tile');
  const title=await c.query('SELECT title FROM "DashboardTile" WHERE id=$1',[ids.tile]);
  check(title.rows[0]?.title==='TEMP owner edit verified','only authorized tile edit persisted');
  await c.query('DELETE FROM "PermissionSetPermission" WHERE "permissionSetId"=$1 AND key=\'Reports.View\'',[ids.permissions]);
  check((await agent('/api/reports/run-adhoc','POST',config)).status===403,'permission revocation takes effect in existing session');
  await c.query('UPDATE "User" SET "isActive"=false,"updatedAt"=now() WHERE id=$1',[ids.agent]);
  check((await agent('/api/dashboards/tile-data','POST',{kind:'kpi',queryKey:'tasks.open_overdue'})).status===401,'deactivation invalidates existing session');
  console.log('LIVE_ROLE_CHECKS_PASSED '+assertions);
 } finally {
  await c.query('ROLLBACK');
  await c.query('BEGIN');
  await c.query('UPDATE "User" SET "isActive"=false,"updatedAt"=now() WHERE id = ANY($1::text[])',[[ids.agent,ids.manager]]);
  await c.query('DELETE FROM "Task" WHERE id = ANY($1::text[])',[[ids.agentTask,ids.managerTask]]);
  await c.query('DELETE FROM "Report" WHERE id=$1',[ids.report]);
  await c.query('DELETE FROM "Dashboard" WHERE id=$1',[ids.dashboard]);
  await c.query('DELETE FROM "PermissionSet" WHERE id=$1',[ids.permissions]);
  await c.query('COMMIT');
  const users=await c.query('SELECT name,"isActive" FROM "User" WHERE id = ANY($1::text[])',[[ids.agent,ids.manager]]);
  console.log('CLEANUP '+JSON.stringify(users.rows));
  await c.end();
 }
})().catch(e=>{console.error(e.message.startsWith('FAILED:')?e.message:(e.code||e.name||'TEST_FAILED'));process.exitCode=1});
