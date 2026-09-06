import { randomUUID } from "crypto";
import { db } from "../db";

export class SqliteStore<T extends { id: string }> {
  private table: string;

  constructor(table: string) {
    this.table = table;
    db.exec(`CREATE TABLE IF NOT EXISTS ${table} (id TEXT PRIMARY KEY, data TEXT NOT NULL)`);
  }

  findAll(): T[] {
    const rows = db.prepare(`SELECT data FROM ${this.table}`).all() as { data: string }[];
    return rows.map((row) => JSON.parse(row.data) as T);
  }

  findById(id: string): T | undefined {
    const row = db.prepare(`SELECT data FROM ${this.table} WHERE id = ?`).get(id) as { data: string } | undefined;
    return row ? (JSON.parse(row.data) as T) : undefined;
  }

  create(data: Omit<T, "id">): T {
    const item = { ...data, id: randomUUID() } as T;
    db.prepare(`INSERT INTO ${this.table} (id, data) VALUES (?, ?)`).run(item.id, JSON.stringify(item));
    return item;
  }

  update(id: string, data: Partial<T>): T | undefined {
    const existing = this.findById(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...data, id } as T;
    db.prepare(`UPDATE ${this.table} SET data = ? WHERE id = ?`).run(JSON.stringify(updated), id);
    return updated;
  }

  delete(id: string): boolean {
    const result = db.prepare(`DELETE FROM ${this.table} WHERE id = ?`).run(id);
    return Number(result.changes) > 0;
  }
}

export class SqliteSetting<T extends object> {
  private key: string;
  private defaultValue: T;

  constructor(key: string, defaultValue: T) {
    this.key = key;
    this.defaultValue = defaultValue;
    db.exec("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
  }

  get(): T {
    const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(this.key) as
      | { value: string }
      | undefined;
    if (!row) {
      db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run(this.key, JSON.stringify(this.defaultValue));
      return this.defaultValue;
    }
    return JSON.parse(row.value) as T;
  }

  update(patch: Partial<T>): T {
    const updated = { ...this.get(), ...patch };
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(
      this.key,
      JSON.stringify(updated)
    );
    return updated;
  }
}
