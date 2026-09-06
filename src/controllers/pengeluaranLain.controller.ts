import { Request, Response } from "express";
import { SqliteStore } from "../utils/sqliteStore";
import { PengeluaranLain, StatusPengeluaran } from "../models/types";
import { ApiError } from "../middlewares/errorHandler";

const store = new SqliteStore<PengeluaranLain>("pengeluaran_lain");
const VALID_STATUS: StatusPengeluaran[] = ["selesai", "dibatalkan"];

export const pengeluaranLainController = {
  list(_req: Request, res: Response) {
    res.json(store.findAll());
  },

  get(req: Request, res: Response) {
    const item = store.findById(String(req.params.id));
    if (!item) throw new ApiError(404, "Pengeluaran lain tidak ditemukan");
    res.json(item);
  },

  create(req: Request, res: Response) {
    const { kategori, deskripsi, tanggal, jumlah, status } = req.body;
    if (!kategori || !jumlah) throw new ApiError(400, "kategori dan jumlah wajib diisi");

    const item = store.create({
      kategori,
      deskripsi,
      tanggal: tanggal || new Date().toISOString(),
      jumlah: Number(jumlah),
      status: status && VALID_STATUS.includes(status) ? status : "selesai",
      createdAt: new Date().toISOString(),
    });
    res.status(201).json(item);
  },

  update(req: Request, res: Response) {
    const item = store.update(String(req.params.id), req.body);
    if (!item) throw new ApiError(404, "Pengeluaran lain tidak ditemukan");
    res.json(item);
  },

  remove(req: Request, res: Response) {
    const deleted = store.delete(String(req.params.id));
    if (!deleted) throw new ApiError(404, "Pengeluaran lain tidak ditemukan");
    res.status(204).send();
  },
};
