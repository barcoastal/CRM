const { createServer } = require("http");
const { parse } = require("url");
const { execSync } = require("child_process");
const next = require("next");

const port = parseInt(process.env.PORT || "3000", 10);

// Push schema changes to DB at startup (runtime has DB access)
try {
  console.log("> Running prisma db push...");
  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    stdio: "inherit",
    env: process.env,
  });
  console.log("> Prisma schema synced successfully");
} catch (err) {
  console.error("> Warning: prisma db push failed:", err.message);
  // Continue anyway — schema might already be up to date
}

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
  });
}).catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
