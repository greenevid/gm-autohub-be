import { Request, Response } from "express";
import { SqliteStore } from "../utils/sqliteStore";
import { Servis, StatusServis } from "../models/types";
import { ApiError } from "../middlewares/errorHandler";

const store = new SqliteStore<Servis>("servis");
const VALID_STATUS: StatusServis[] = ["antrian", "dikerjakan", "menunggu_sparepart", "selesai", "dibatalkan"];

export const servisController = {
  list(_req: Request, res: Response) {
    res.json(store.findAll());
  },

  get(req: Request, res: Response) {
    const item = store.findById(String(req.params.id));
    if (!item) throw new ApiError(404, "Servis tidak ditemukan");
    res.json(item);
  },

  create(req: Request, res: Response) {
    const { kendaraanId, mekanikId, keluhan, items, estimasiSelesai } = req.body;
    if (!kendaraanId || !keluhan) throw new ApiError(400, "kendaraanId dan keluhan wajib diisi");
    const now = new Date().toISOString();
    const item = store.create({
      kendaraanId,
      mekanikId,
      keluhan,
      status: "antrian",
      items: items ?? [],
      estimasiSelesai,
      createdAt: now,
      updatedAt: now,
    });
    res.status(201).json(item);
  },

  update(req: Request, res: Response) {
    const { status, ...rest } = req.body;
    if (status && !VALID_STATUS.includes(status)) {
      throw new ApiError(400, `status harus salah satu dari: ${VALID_STATUS.join(", ")}`);
    }
    const item = store.update(String(req.params.id), {
      ...rest,
      ...(status ? { status } : {}),
      updatedAt: new Date().toISOString(),
    });
    if (!item) throw new ApiError(404, "Servis tidak ditemukan");
    res.json(item);
  },

  remove(req: Request, res: Response) {
    const deleted = store.delete(String(req.params.id));
    if (!deleted) throw new ApiError(404, "Servis tidak ditemukan");
    res.status(204).send();
  },
};
