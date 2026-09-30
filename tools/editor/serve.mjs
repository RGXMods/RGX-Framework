// Source-only, loopback-only static editor. No writes, credentials, or game access.
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const root = new URL("../../", import.meta.url);
const assets = new Map([
  ["/", ["tools/editor/index.html", "text/html; charset=utf-8"]],
  ["/tools/contract/definition.mjs", ["tools/contract/definition.mjs", "text/javascript; charset=utf-8"]],
  ["/schemas/rgx-definition.schema.json", ["schemas/rgx-definition.schema.json", "application/json"]],
]);
export function createEditorServer() {
  return createServer((request, response) => {
    if (request.method !== "GET") { response.writeHead(405); response.end(); return; }
    const asset = assets.get(request.url);
    if (!asset) { response.writeHead(404); response.end(); return; }
    response.writeHead(200, { "Content-Type": asset[1], "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
    response.end(readFileSync(new URL(asset[0], root)));
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createEditorServer().listen(18790, "127.0.0.1", () => console.log("RGX editor: http://127.0.0.1:18790 (source-only; stop with Ctrl+C)"));
}
