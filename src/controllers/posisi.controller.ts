import { Request, Response } from "express";
import { SqliteStore } from "../utils/sqliteStore";
import { Posisi } from "../models/types";
import { ApiError } from "../middlewares/errorHandler";

const store = new SqliteStore<Posisi>("posisi");

function generateKode(): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const todayPrefix = `POS-${yy}${mm}${dd}-`;
  const countToday = store.findAll().filter((p) => p.kode.startsWith(todayPrefix)).length;
  return `${todayPrefix}${String(countToday + 1).padStart(4, "0")}`;
}

export const posisiController = {
  list(req: Request, res: Response) {
    const { search } = req.query;
    let items = store.findAll();
    if (typeof search === "string" && search.trim()) {
      const q = search.trim().toLowerCase();
      items = items.filter((p) => p.nama.toLowerCase().includes(q) || p.kode.toLowerCase().includes(q));
    }
    res.json(items);
  },

  get(req: Request, res: Response) {
    const item = store.findById(String(req.params.id));
    if (!item) throw new ApiError(404, "Posisi tidak ditemukan");
    res.json(item);
  },

  create(req: Request, res: Response) {
    const { nama, deskripsi, aktif, dapatDitugaskanServis } = req.body;
    if (!nama) throw new ApiError(400, "nama wajib diisi");
    const item = store.create({
      kode: generateKode(),
      nama,
      deskripsi: deskripsi || undefined,
      aktif: aktif ?? true,
      dapatDitugaskanServis: dapatDitugaskanServis ?? true,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json(item);
  },

  update(req: Request, res: Response) {
    const item = store.update(String(req.params.id), req.body);
    if (!item) throw new ApiError(404, "Posisi tidak ditemukan");
    res.json(item);
  },

  remove(req: Request, res: Response) {
    const deleted = store.delete(String(req.params.id));
    if (!deleted) throw new ApiError(404, "Posisi tidak ditemukan");
    res.status(204).send();
  },
};
