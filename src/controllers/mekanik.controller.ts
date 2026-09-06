import { Request, Response } from "express";
import { SqliteStore } from "../utils/sqliteStore";
import { Mekanik } from "../models/types";
import { ApiError } from "../middlewares/errorHandler";

const store = new SqliteStore<Mekanik>("mekanik");

export const mekanikController = {
  async list(_req: Request, res: Response) {
    res.json(await store.findAll());
  },

  async get(req: Request, res: Response) {
    const item = await store.findById(String(req.params.id));
    if (!item) throw new ApiError(404, "Mekanik tidak ditemukan");
    res.json(item);
  },

  async create(req: Request, res: Response) {
    const { nama, spesialisasi } = req.body;
    if (!nama) throw new ApiError(400, "nama wajib diisi");
    const item = await store.create({ nama, spesialisasi, createdAt: new Date().toISOString() });
    res.status(201).json(item);
  },

  async update(req: Request, res: Response) {
    const item = await store.update(String(req.params.id), req.body);
    if (!item) throw new ApiError(404, "Mekanik tidak ditemukan");
    res.json(item);
  },

  async remove(req: Request, res: Response) {
    const deleted = await store.delete(String(req.params.id));
    if (!deleted) throw new ApiError(404, "Mekanik tidak ditemukan");
    res.status(204).send();
  },
};
