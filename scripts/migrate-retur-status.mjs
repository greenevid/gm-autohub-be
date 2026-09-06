import { DatabaseSync } from "node:sqlite";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "..", "data", "bengkel.db");

const db = new DatabaseSync(dbPath);
const rows = db.prepare("SELECT id, data FROM retur").all();

let updated = 0;
for (const row of rows) {
  const retur = JSON.parse(row.data);
  if (retur.status) continue;
  retur.status = "selesai";
  retur.subtotal = retur.total;
  db.prepare("UPDATE retur SET data = ? WHERE id = ?").run(JSON.stringify(retur), row.id);
  updated += 1;
}

console.log(`Migrated ${updated} of ${rows.length} retur record(s).`);
