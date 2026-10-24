// HTTP entry point: serves the web UI from public/ and the GraphQL API on
// /graphql. Server dependency: graphql-js. GSAP and fonts are served from node_modules.

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { networkInterfaces } from "node:os";
import { buildSchema, graphql } from "graphql";
import { chainFor, getDoConfig, getLlmConfig } from "./ai/llm.ts";
import { problemResolvers, problemTypeDefs } from "./problems.ts";
import { resolvers, typeDefs } from "./schema.ts";
import { teacherResolvers, teacherTypeDefs } from "./teachers.ts";

const PORT = Number(process.env.PORT ?? 3000);
const PUBLIC_DIR = fileURLToPath(new URL("../public/", import.meta.url));
const MODULES_DIR = fileURLToPath(new URL("../node_modules/", import.meta.url));

// Front-end libraries are served from node_modules so the demo works offline.
const VENDOR: Record<string, string> = {
  "/vendor/gsap/": "gsap/dist/",
  "/vendor/fonts/montserrat/": "@fontsource/montserrat/",
  "/vendor/fonts/nunito-sans/": "@fontsource/nunito-sans/",
};

const schema = buildSchema(typeDefs + problemTypeDefs + teacherTypeDefs);

// graphql-js root resolvers receive (args, context); erxes-style resolvers
// take (parent, args, context). Adapt once here.
type Resolver = (parent: unknown, args: Record<string, unknown>, ctx: unknown) => unknown;
const rootValue: Record<string, (args: Record<string, unknown>, ctx: unknown) => unknown> = {};
for (const [name, fn] of Object.entries({
  ...resolvers.Query,
  ...resolvers.Mutation,
  ...problemResolvers.Query,
  ...problemResolvers.Mutation,
  ...teacherResolvers.Query,
  ...teacherResolvers.Mutation,
})) {
  rootValue[name] = (args, ctx) => (fn as Resolver)(undefined, args, ctx);
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".txt": "text/plain; charset=utf-8",
};

const sendJson = (res: ServerResponse, status: number, body: unknown): void => {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
};

const readBody = async (req: IncomingMessage): Promise<string> => {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > 1_000_000) throw new Error("Request body too large");
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
};

const handleGraphql = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
  try {
    const body = JSON.parse(await readBody(req)) as {
      query?: string;
      variables?: Record<string, unknown>;
      operationName?: string;
    };
    if (!body.query) return sendJson(res, 400, { errors: [{ message: "Missing query" }] });

    const result = await graphql({
      schema,
      source: body.query,
      rootValue,
      contextValue: {},
      variableValues: body.variables,
      operationName: body.operationName,
    });
    sendJson(res, 200, result);
  } catch (e) {
    sendJson(res, 400, { errors: [{ message: (e as Error).message }] });
  }
};

const serveStatic = async (pathname: string, res: ServerResponse): Promise<void> => {
  const prefix = Object.keys(VENDOR).find((p) => pathname.startsWith(p));
  const root = prefix ? join(MODULES_DIR, VENDOR[prefix]) : PUBLIC_DIR;
  const rel = prefix
    ? decodeURIComponent(pathname.slice(prefix.length))
    : pathname === "/"
      ? "index.html"
      : decodeURIComponent(pathname.slice(1));
  const filePath = normalize(join(root, rel));
  if (!filePath.startsWith(root.replace(/[\\/]$/, "") + sep)) {
    res.writeHead(403).end("Forbidden");
    return;
  }
  try {
    const data = await readFile(filePath);
    res.writeHead(200, {
      "Content-Type": MIME[extname(filePath)] ?? "application/octet-stream",
      "Cache-Control": prefix ? "public, max-age=86400" : "no-cache",
    });
    res.end(data);
  } catch {
    res.writeHead(404).end("Not found");
  }
};

const server = createServer((req, res) => {
  const { pathname } = new URL(req.url ?? "/", "http://localhost");

  if (pathname === "/health") return sendJson(res, 200, { ok: true });
  if (pathname === "/graphql" && req.method === "POST") return void handleGraphql(req, res);
  if (req.method === "GET") return void serveStatic(pathname, res);

  res.writeHead(405).end("Method not allowed");
});

server.listen(PORT, () => {
  const ai = getLlmConfig();
  console.log(`Hugjuulai school operations demo → http://localhost:${PORT}`);
  // Listening on all interfaces, so phones/laptops on the same Wi-Fi can open these:
  for (const nets of Object.values(networkInterfaces())) {
    for (const n of nets ?? []) {
      if (n.family === "IPv4" && !n.internal) console.log(`  on your network → http://${n.address}:${PORT}`);
    }
  }
  const dOcean = getDoConfig();
  const pri = chainFor("priority")[0];
  console.log(`AI help:     ${ai.provider} · ${ai.model}${ai.provider !== "none" && ai.provider !== "openai" && !ai.apiKey ? "  (no AI_API_KEY)" : ""}`);
  console.log(`AI priority: ${pri.provider} · ${pri.model}${dOcean ? "" : "  (no DO_API_KEY — using the help provider)"}`);
});
