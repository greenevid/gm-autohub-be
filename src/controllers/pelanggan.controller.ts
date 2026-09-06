import { Request, Response } from "express";
import { randomBytes } from "crypto";
import { SqliteStore } from "../utils/sqliteStore";
import { Pelanggan, StatusPelanggan } from "../models/types";
import { ApiError } from "../middlewares/errorHandler";

export const pelangganStore = new SqliteStore<Pelanggan>("pelanggan");
const store = pelangganStore;

function randomCode(length: number): string {
  return randomBytes(length).toString("hex").toUpperCase().slice(0, length);
}

function generateKode(): string {
  return `CUST-${randomCode(3)}-${randomCode(4)}`;
}

export const pelangganController = {
  list(req: Request, res: Response) {
    const { search, status } = req.query;
    let items = store.findAll();

    if (typeof search === "string" && search.trim()) {
      const q = search.trim().toLowerCase();
      items = items.filter(
        (p) => p.kode.toLowerCase().includes(q) || p.nama.toLowerCase().includes(q)
      );
    }
    if (typeof status === "string" && status) {
      items = items.filter((p) => p.status === status);
    }

    res.json(items);
  },

  stats(_req: Request, res: Response) {
    const items = store.findAll();
    res.json({
      total: items.length,
      aktif: items.filter((p) => p.status === "aktif").length,
      nonaktif: items.filter((p) => p.status === "nonaktif").length,
    });
  },

  get(req: Request, res: Response) {
    const item = store.findById(String(req.params.id));
    if (!item) throw new ApiError(404, "Pelanggan tidak ditemukan");
    res.json(item);
  },

  create(req: Request, res: Response) {
    const {
      nama,
      tipe,
      telepon,
      email,
      npwp,
      nik,
      tanggalLahir,
      kota,
      syaratPembayaran,
      alamat,
      alamatPengiriman,
      alamatPenagihan,
      namaPIC,
      kontakPIC,
      plafonKredit,
      status,
    } = req.body;

    if (!nama || !telepon || !email || !kota || !alamat) {
      throw new ApiError(400, "nama, telepon, email, kota, dan alamat wajib diisi");
    }

    const item = store.create({
      kode: generateKode(),
      nama,
      tipe: tipe || undefined,
      telepon,
      email,
      npwp: npwp || undefined,
      nik: nik || undefined,
      tanggalLahir: tanggalLahir || undefined,
      kota,
      syaratPembayaran: syaratPembayaran || undefined,
      alamat,
      alamatPengiriman: alamatPengiriman || undefined,
      alamatPenagihan: alamatPenagihan || undefined,
      namaPIC: namaPIC || undefined,
      kontakPIC: kontakPIC || undefined,
      plafonKredit: plafonKredit !== undefined && plafonKredit !== "" ? Number(plafonKredit) : undefined,
      status: (status as StatusPelanggan) || "aktif",
      createdAt: new Date().toISOString(),
    });
    res.status(201).json(item);
  },

  update(req: Request, res: Response) {
    const item = store.update(String(req.params.id), req.body);
    if (!item) throw new ApiError(404, "Pelanggan tidak ditemukan");
    res.json(item);
  },

  remove(req: Request, res: Response) {
    const deleted = store.delete(String(req.params.id));
    if (!deleted) throw new ApiError(404, "Pelanggan tidak ditemukan");
    res.status(204).send();
  },
};
