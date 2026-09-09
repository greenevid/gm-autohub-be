import { Request, Response } from "express";
import { SqliteStore } from "../utils/sqliteStore";
import { Lokasi, StatusLokasi, TipeLokasi } from "../models/types";
import { ApiError } from "../middlewares/errorHandler";

const store = new SqliteStore<Lokasi>("lokasi");

const VALID_TIPE: TipeLokasi[] = ["toko", "gudang", "cabang"];
const VALID_STATUS: StatusLokasi[] = ["aktif", "nonaktif"];

export const lokasiController = {
  async list(req: Request, res: Response) {
    const { search } = req.query;
    let items = await store.findAll();
    if (typeof search === "string" && search.trim()) {
      const q = search.trim().toLowerCase();
      items = items.filter((l) => l.nama.toLowerCase().includes(q) || l.kota.toLowerCase().includes(q));
    }
    res.json(items);
  },

  async get(req: Request, res: Response) {
    const item = await store.findById(String(req.params.id));
    if (!item) throw new ApiError(404, "Lokasi tidak ditemukan");
    res.json(item);
  },

  async create(req: Request, res: Response) {
    const { nama, tipe, alamat, kota, telepon, status } = req.body;
    if (!nama) throw new ApiError(400, "nama wajib diisi");
    if (!tipe || !VALID_TIPE.includes(tipe)) {
      throw new ApiError(400, `tipe harus salah satu dari: ${VALID_TIPE.join(", ")}`);
    }
    if (!alamat) throw new ApiError(400, "alamat wajib diisi");
    if (!kota) throw new ApiError(400, "kota wajib diisi");
    if (!telepon) throw new ApiError(400, "telepon wajib diisi");

    const item = await store.create({
      nama,
      tipe,
      alamat,
      kota,
      telepon,
      status: status && VALID_STATUS.includes(status) ? status : "aktif",
      createdAt: new Date().toISOString(),
    });
    res.status(201).json(item);
  },

  async update(req: Request, res: Response) {
    const { tipe, status, ...rest } = req.body;
    const patch: Partial<Lokasi> = { ...rest };
    if (tipe !== undefined) {
      if (!VALID_TIPE.includes(tipe)) throw new ApiError(400, `tipe harus salah satu dari: ${VALID_TIPE.join(", ")}`);
      patch.tipe = tipe;
    }
    if (status !== undefined) {
      if (!VALID_STATUS.includes(status)) throw new ApiError(400, `status harus salah satu dari: ${VALID_STATUS.join(", ")}`);
      patch.status = status;
    }
    const item = await store.update(String(req.params.id), patch);
    if (!item) throw new ApiError(404, "Lokasi tidak ditemukan");
    res.json(item);
  },

  async remove(req: Request, res: Response) {
    const deleted = await store.delete(String(req.params.id));
    if (!deleted) throw new ApiError(404, "Lokasi tidak ditemukan");
    res.status(204).send();
  },
};
