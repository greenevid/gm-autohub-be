import { DatabaseSync } from "node:sqlite";
import fs from "fs";
import path from "path";
import { env } from "./config/env";

fs.mkdirSync(path.dirname(env.dbPath), { recursive: true });

export const db = new DatabaseSync(env.dbPath);
db.exec("PRAGMA journal_mode = WAL");
