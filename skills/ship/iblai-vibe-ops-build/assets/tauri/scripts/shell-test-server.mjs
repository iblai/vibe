// The shell smoke's stand-in site on 127.0.0.1:8765: serves a directory, an
// extensionless file as text/html (the auth contract's return paths), and logs
// one `GET <path><query> <status>` line per request for the checks to read.
//   node scripts/shell-test-server.mjs <dir>
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const dir = process.argv[2];
const types = {
  "": "text/html",
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
};

createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1:8765");
  let path = normalize(url.pathname);
  if (path.endsWith("/")) path += "index.html";
  let status = 200;
  try {
    const body = await readFile(join(dir, path));
    res
      .writeHead(status, { "content-type": types[extname(path)] ?? "application/octet-stream" })
      .end(body);
  } catch {
    status = 404;
    res.writeHead(status).end();
  }
  console.log(`GET ${url.pathname}${url.search} ${status}`);
}).listen(8765, "127.0.0.1", () => console.log("listening on http://127.0.0.1:8765"));
