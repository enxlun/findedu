import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

// erxes.json sits at the repository root, two levels above src/, and is the
// single source of the plugin's identity and ports, as in ../hugjuulai.
// Gemma 4 settings (AI_*, DO_*) are read by ai/llm.ts.
const ROOT = fileURLToPath(new URL("../../", import.meta.url));

interface Manifest {
  name: string;
  title: string;
  version: string;
  api: { port: number; graphql: string; health: string };
}

export const manifest = JSON.parse(readFileSync(resolve(ROOT, "erxes.json"), "utf8")) as Manifest;

export const env = {
  PORT: Number(process.env.PORT) || manifest.api.port,
  // Relative paths resolve from the repository root, wherever the process starts.
  DB_PATH: resolve(ROOT, process.env.DB_PATH || "data/db.json"),
};

// The API serves the demo UI itself: ui/public at /, ui/src at /src/, and the
// UI's front-end packages (GSAP, fonts) from ui/node_modules at /vendor/.
export const paths = {
  uiPublic: resolve(ROOT, "ui/public"),
  uiSrc: resolve(ROOT, "ui/src"),
  uiModules: resolve(ROOT, "ui/node_modules"),
};
