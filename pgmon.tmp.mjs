import pg from "pg";
const c = new pg.Client({ connectionString: process.env.PGURL, ssl:{rejectUnauthorized:false}, connectionTimeoutMillis:10000 });
await c.connect();
const start = Date.now();
let i=0;
while (Date.now()-start < 130000) {
  i++;
  const [{rows:[s]}, {rows:act}] = await Promise.all([
    c.query("SELECT count(*) total, count(*) FILTER (WHERE state='active') active, count(*) FILTER (WHERE state='idle in transaction') iit FROM pg_stat_activity WHERE pid<>pg_backend_pid()"),
    c.query("SELECT pid, state, wait_event, round(extract(epoch from now()-query_start)) rt, left(regexp_replace(query,'\\s+',' ','g'),70) q FROM pg_stat_activity WHERE state<>'idle' AND pid<>pg_backend_pid() ORDER BY query_start LIMIT 6"),
  ]);
  const ts = new Date().toISOString().slice(11,19);
  let line = `[${ts}] conns=${s.total} active=${s.active} idle_in_txn=${s.iit}`;
  if (act.length) line += "  | " + act.map(a=>`pid${a.pid}:${a.state}/${a.wait_event||'-'}/${a.rt||0}s:${a.q}`).join("  ");
  console.log(line);
  await new Promise(r=>setTimeout(r,2000));
}
await c.end();
console.log("monitor done");
