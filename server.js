const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");

process.env.ESIGN_INTERNAL_JOB_KEY = require("crypto").randomBytes(32).toString("hex");

const port = parseInt(process.env.PORT || "3000", 10);

// Apply reviewed migrations before deployment. Starting the app must never
// rewrite the production schema or accept data loss automatically.

const app = next({ dev: false });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => {
    if (req.url === "/_health") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("OK");
      return;
    }
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  }).listen(port, "0.0.0.0", () => {
    console.log(`> Ready on http://0.0.0.0:${port}`);
    // Each instance may run this; per-envelope database locks deduplicate jobs.
    // Enable only after the packet schema and delivery settings are validated.
    if (process.env.ESIGN_REMINDERS_ENABLED === "true") {
      const timer = setInterval(() => {
        fetch(`http://127.0.0.1:${port}/api/cron/esign`, {method:"POST",headers:{"x-esign-job-key":process.env.ESIGN_INTERNAL_JOB_KEY}})
          .then(r=>{if(!r.ok)console.error("E-sign scheduled job failed:",r.status);}).catch(()=>console.error("E-sign scheduled job unavailable"));
      }, 15 * 60 * 1000);
      timer.unref();
    }
  });
}).catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
