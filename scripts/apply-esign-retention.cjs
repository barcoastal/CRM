// Run in the intended environment after confirming backups and deployment scope.
// node scripts/apply-esign-retention.cjs --check | --apply
const { Client } = require('pg');
const { readFile } = require('node:fs/promises');
const path = require('node:path');
(async () => {
  if (!['--check','--apply'].includes(process.argv[2])) throw new Error('Use --check or --apply');
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const db = new Client({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:10000,statement_timeout:30000});
  try {
    await db.connect();
    if (process.argv[2] === '--apply') await db.query(await readFile(path.join(__dirname,'../prisma/sql/esign-evidence-retention.sql'),'utf8'));
    const result=await db.query(`SELECT current_database() AS database, (SELECT count(*)::int FROM "Envelope") AS envelopes, (SELECT count(*)::int FROM pg_trigger WHERE tgname IN ('esign_completed_immutable','esign_audit_append_only') AND tgenabled='O') AS retention_triggers`);
    console.log(JSON.stringify(result.rows[0]));
    if(process.argv[2] === '--apply' && result.rows[0].retention_triggers!==2) throw new Error('Retention verification failed');
  } finally {await db.end();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
