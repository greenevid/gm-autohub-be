import { Request, Response } from "express";
import { SqliteStore } from "../utils/sqliteStore";
import { Mekanik } from "../models/types";
import { ApiError } from "../middlewares/errorHandler";

const store = new SqliteStore<Mekanik>("mekanik");

export const mekanikController = {
  list(_req: Request, res: Response) {
    res.json(store.findAll());
  },

  get(req: Request, res: Response) {
    const item = store.findById(String(req.params.id));
    if (!item) throw new ApiError(404, "Mekanik tidak ditemukan");
    res.json(item);
  },

  create(req: Request, res: Response) {
    const { nama, spesialisasi } = req.body;
    if (!nama) throw new ApiError(400, "nama wajib diisi");
    const item = store.create({ nama, spesialisasi, createdAt: new Date().toISOString() });
    res.status(201).json(item);
  },

  update(req: Request, res: Response) {
    const item = store.update(String(req.params.id), req.body);
    if (!item) throw new ApiError(404, "Mekanik tidak ditemukan");
    res.json(item);
  },

  remove(req: Request, res: Response) {
    const deleted = store.delete(String(req.params.id));
    if (!deleted) throw new ApiError(404, "Mekanik tidak ditemukan");
    res.status(204).send();
  },
};
