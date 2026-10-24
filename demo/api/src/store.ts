// Tiny JSON-file store for the demo. In the erxes plugin these collections
// become tenant-scoped Mongoose models (see docs/erxes-integration.md);
// module-specific reads live in modules/<module>/db/models/.

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { env } from "./config.ts";
import { buildSeed, SEED_VERSION, type Db } from "./seed.ts";
import type { User } from "./types.ts";

let db: Db | undefined;

const load = (): Db => {
  if (db) return db;
  const stored = existsSync(env.DB_PATH) ? (JSON.parse(readFileSync(env.DB_PATH, "utf8")) as Partial<Db>) : undefined;
  if (stored && stored.version === SEED_VERSION) {
    db = stored as Db;
  } else {
    db = buildSeed();
    save();
  }
  return db;
};

export const save = (): void => {
  if (!db) return;
  mkdirSync(dirname(env.DB_PATH), { recursive: true });
  const tmp = `${env.DB_PATH}.tmp`;
  writeFileSync(tmp, JSON.stringify(db, null, 2));
  renameSync(tmp, env.DB_PATH);
};

export const resetDb = (): void => {
  db = buildSeed();
  save();
};

export const newId = (prefix: string): string => `${prefix}-${randomUUID().slice(0, 8)}`;
export const getDb = (): Db => load();

export const findUser = (userId: string): User => {
  const user = load().users.find((u) => u._id === userId);
  if (!user) throw new Error(`Unknown user: ${userId}`);
  return user;
};
