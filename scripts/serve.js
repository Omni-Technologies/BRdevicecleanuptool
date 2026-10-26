"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const port = Number(process.env.BR_FIELDSORT_PORT || process.argv[2] || 8080);
const publicFiles = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/index.html", ["index.html", "text/html; charset=utf-8"]],
  ["/styles.css", ["styles.css", "text/css; charset=utf-8"]],
  ["/parser.js", ["parser.js", "text/javascript; charset=utf-8"]],
  ["/ai.js", ["ai.js", "text/javascript; charset=utf-8"]],
  ["/app.js", ["app.js", "text/javascript; charset=utf-8"]]
]);

const server = http.createServer((request, response) => {
  const pathname = new URL(request.url, "http://localhost").pathname;
  const asset = publicFiles.get(pathname);
  if (!asset) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  const [fileName, contentType] = asset;
  fs.readFile(path.join(root, fileName), (error, content) => {
    if (error) {
      response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Unable to read the requested file");
      return;
    }
    response.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    });
    response.end(content);
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`BR FieldSort is available at http://127.0.0.1:${port}`);
  console.log("Press Ctrl+C to stop the local server.");
});
