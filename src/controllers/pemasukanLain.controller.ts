import { Request, Response } from "express";
import { SqliteStore } from "../utils/sqliteStore";
import { PemasukanLain, StatusPemasukan } from "../models/types";
import { ApiError } from "../middlewares/errorHandler";

const store = new SqliteStore<PemasukanLain>("pemasukan_lain");
const VALID_STATUS: StatusPemasukan[] = ["selesai", "dibatalkan"];

export const pemasukanLainController = {
  async list(_req: Request, res: Response) {
    res.json(await store.findAll());
  },

  async get(req: Request, res: Response) {
    const item = await store.findById(String(req.params.id));
    if (!item) throw new ApiError(404, "Pemasukan lain tidak ditemukan");
    res.json(item);
  },

  async create(req: Request, res: Response) {
    const { kategori, deskripsi, tanggal, jumlah, status } = req.body;
    if (!kategori || !jumlah) throw new ApiError(400, "kategori dan jumlah wajib diisi");

    const item = await store.create({
      kategori,
      deskripsi,
      tanggal: tanggal || new Date().toISOString(),
      jumlah: Number(jumlah),
      status: status && VALID_STATUS.includes(status) ? status : "selesai",
      createdAt: new Date().toISOString(),
    });
    res.status(201).json(item);
  },

  async update(req: Request, res: Response) {
    const item = await store.update(String(req.params.id), req.body);
    if (!item) throw new ApiError(404, "Pemasukan lain tidak ditemukan");
    res.json(item);
  },

  async remove(req: Request, res: Response) {
    const deleted = await store.delete(String(req.params.id));
    if (!deleted) throw new ApiError(404, "Pemasukan lain tidak ditemukan");
    res.status(204).send();
  },
};
