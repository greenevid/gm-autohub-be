import { randomUUID } from "crypto";
import type { PoolConnection } from "mysql2/promise";
import { pool } from "../db";

/**
 * Generic JSON-blob-per-row store, backed by MySQL. Every "table" is just
 * (id VARCHAR PRIMARY KEY, data LONGTEXT) — the actual shape lives entirely
 * in the JSON blob, mirroring the original SQLite-backed version this
 * replaced. Kept under the same name/API to avoid touching every call site;
 * only the internals (and now-async signatures) changed.
 */
export class SqliteStore<T extends { id: string }> {
  private table: string;
  private ready: Promise<void>;

  constructor(table: string) {
    this.table = table;
    this.ready = pool
      .query(`CREATE TABLE IF NOT EXISTS \`${table}\` (id VARCHAR(191) PRIMARY KEY, data LONGTEXT NOT NULL)`)
      .then(() => undefined);
  }

  async findAll(): Promise<T[]> {
    await this.ready;
    const [rows] = await pool.query(`SELECT data FROM \`${this.table}\``);
    return (rows as { data: string }[]).map((row) => JSON.parse(row.data) as T);
  }

  async findById(id: string): Promise<T | undefined> {
    await this.ready;
    const [rows] = await pool.query(`SELECT data FROM \`${this.table}\` WHERE id = ?`, [id]);
    const row = (rows as { data: string }[])[0];
    return row ? (JSON.parse(row.data) as T) : undefined;
  }

  async create(data: Omit<T, "id">): Promise<T> {
    await this.ready;
    const item = { ...data, id: randomUUID() } as T;
    await pool.query(`INSERT INTO \`${this.table}\` (id, data) VALUES (?, ?)`, [item.id, JSON.stringify(item)]);
    return item;
  }

  async update(id: string, data: Partial<T>): Promise<T | undefined> {
    await this.ready;
    const existing = await this.findById(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...data, id } as T;
    await pool.query(`UPDATE \`${this.table}\` SET data = ? WHERE id = ?`, [JSON.stringify(updated), id]);
    return updated;
  }

  /**
   * Read-modify-write under a row lock, for fields multiple requests can
   * touch concurrently (stock counts, running balances, etc.) — a plain
   * findById()-then-update() pair is a lost-update race under MySQL's
   * concurrency, unlike the old single-threaded synchronous SQLite calls
   * this store used to wrap. `mutator` receives the row as it stands inside
   * the transaction (after the lock is acquired) and returns the patch to
   * apply; the whole thing commits atomically.
   */
  async updateWithLock(id: string, mutator: (current: T) => Partial<T>): Promise<T | undefined> {
    await this.ready;
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [rows] = await conn.query(`SELECT data FROM \`${this.table}\` WHERE id = ? FOR UPDATE`, [id]);
      const row = (rows as { data: string }[])[0];
      if (!row) {
        await conn.rollback();
        return undefined;
      }
      const current = JSON.parse(row.data) as T;
      const patch = mutator(current);
      const updated = { ...current, ...patch, id } as T;
      await conn.query(`UPDATE \`${this.table}\` SET data = ? WHERE id = ?`, [JSON.stringify(updated), id]);
      await conn.commit();
      return updated;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  async delete(id: string): Promise<boolean> {
    await this.ready;
    const [result] = await pool.query(`DELETE FROM \`${this.table}\` WHERE id = ?`, [id]);
    return (result as { affectedRows: number }).affectedRows > 0;
  }

  /** Exposes the underlying pool connection for callers that need to batch several stores' writes in one transaction. */
  async withConnection<R>(fn: (conn: PoolConnection) => Promise<R>): Promise<R> {
    await this.ready;
    const conn = await pool.getConnection();
    try {
      return await fn(conn);
    } finally {
      conn.release();
    }
  }
}

export class SqliteSetting<T extends object> {
  private key: string;
  private defaultValue: T;
  private ready: Promise<void>;

  constructor(key: string, defaultValue: T) {
    this.key = key;
    this.defaultValue = defaultValue;
    this.ready = pool
      .query("CREATE TABLE IF NOT EXISTS `settings` (`key` VARCHAR(191) PRIMARY KEY, value LONGTEXT NOT NULL)")
      .then(() => undefined);
  }

  async get(): Promise<T> {
    await this.ready;
    const [rows] = await pool.query("SELECT value FROM `settings` WHERE `key` = ?", [this.key]);
    const row = (rows as { value: string }[])[0];
    if (!row) {
      await pool.query("INSERT INTO `settings` (`key`, value) VALUES (?, ?)", [
        this.key,
        JSON.stringify(this.defaultValue),
      ]);
      return this.defaultValue;
    }
    return JSON.parse(row.value) as T;
  }

  async update(patch: Partial<T>): Promise<T> {
    await this.ready;
    const updated = { ...(await this.get()), ...patch };
    await pool.query(
      "INSERT INTO `settings` (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)",
      [this.key, JSON.stringify(updated)]
    );
    return updated;
  }
}
