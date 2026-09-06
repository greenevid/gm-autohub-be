import { Request, Response } from "express";
import { SqliteStore } from "../utils/sqliteStore";
import { Posisi } from "../models/types";
import { ApiError } from "../middlewares/errorHandler";

const store = new SqliteStore<Posisi>("posisi");

async function generateKode(): Promise<string> {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const todayPrefix = `POS-${yy}${mm}${dd}-`;
  const all = await store.findAll();
  const countToday = all.filter((p) => p.kode.startsWith(todayPrefix)).length;
  return `${todayPrefix}${String(countToday + 1).padStart(4, "0")}`;
}

export const posisiController = {
  async list(req: Request, res: Response) {
    const { search } = req.query;
    let items = await store.findAll();
    if (typeof search === "string" && search.trim()) {
      const q = search.trim().toLowerCase();
      items = items.filter((p) => p.nama.toLowerCase().includes(q) || p.kode.toLowerCase().includes(q));
    }
    res.json(items);
  },

  async get(req: Request, res: Response) {
    const item = await store.findById(String(req.params.id));
    if (!item) throw new ApiError(404, "Posisi tidak ditemukan");
    res.json(item);
  },

  async create(req: Request, res: Response) {
    const { nama, deskripsi, aktif, dapatDitugaskanServis } = req.body;
    if (!nama) throw new ApiError(400, "nama wajib diisi");
    const item = await store.create({
      kode: await generateKode(),
      nama,
      deskripsi: deskripsi || undefined,
      aktif: aktif ?? true,
      dapatDitugaskanServis: dapatDitugaskanServis ?? true,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json(item);
  },

  async update(req: Request, res: Response) {
    const item = await store.update(String(req.params.id), req.body);
    if (!item) throw new ApiError(404, "Posisi tidak ditemukan");
    res.json(item);
  },

  async remove(req: Request, res: Response) {
    const deleted = await store.delete(String(req.params.id));
    if (!deleted) throw new ApiError(404, "Posisi tidak ditemukan");
    res.status(204).send();
  },
};
