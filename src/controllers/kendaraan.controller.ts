import { Request, Response } from "express";
import { SqliteStore } from "../utils/sqliteStore";
import { Kendaraan } from "../models/types";
import { ApiError } from "../middlewares/errorHandler";

const store = new SqliteStore<Kendaraan>("kendaraan");

export const kendaraanController = {
  list(_req: Request, res: Response) {
    res.json(store.findAll());
  },

  get(req: Request, res: Response) {
    const item = store.findById(String(req.params.id));
    if (!item) throw new ApiError(404, "Kendaraan tidak ditemukan");
    res.json(item);
  },

  create(req: Request, res: Response) {
    const { pelangganId, tipe, platNomor, merk, model, tahun, warna } = req.body;
    if (!pelangganId || !tipe || !platNomor || !merk || !model || !tahun) {
      throw new ApiError(400, "pelangganId, tipe, platNomor, merk, model, dan tahun wajib diisi");
    }
    const item = store.create({
      pelangganId,
      tipe,
      platNomor,
      merk,
      model,
      tahun: Number(tahun),
      warna: warna || undefined,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json(item);
  },

  update(req: Request, res: Response) {
    const item = store.update(String(req.params.id), req.body);
    if (!item) throw new ApiError(404, "Kendaraan tidak ditemukan");
    res.json(item);
  },

  remove(req: Request, res: Response) {
    const deleted = store.delete(String(req.params.id));
    if (!deleted) throw new ApiError(404, "Kendaraan tidak ditemukan");
    res.status(204).send();
  },
};
