import { Request, Response } from "express";
import { SqliteStore } from "../utils/sqliteStore";
import { Supplier, StatusSupplier } from "../models/types";
import { ApiError } from "../middlewares/errorHandler";

export const supplierStore = new SqliteStore<Supplier>("supplier");
const store = supplierStore;

function slugify(nama: string): string {
  return nama
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function generateKode(nama: string): string {
  const base = `SUP-${slugify(nama) || "SUPPLIER"}`;
  const existingCodes = store.findAll().map((s) => s.kode);
  if (!existingCodes.includes(base)) return base;
  let suffix = 2;
  while (existingCodes.includes(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

export const supplierController = {
  list(req: Request, res: Response) {
    const { search, status } = req.query;
    let items = store.findAll();

    if (typeof search === "string" && search.trim()) {
      const q = search.trim().toLowerCase();
      items = items.filter(
        (s) => s.kode.toLowerCase().includes(q) || s.nama.toLowerCase().includes(q)
      );
    }
    if (typeof status === "string" && status) {
      items = items.filter((s) => s.status === status);
    }

    res.json(items);
  },

  stats(_req: Request, res: Response) {
    const items = store.findAll();
    res.json({
      total: items.length,
      aktif: items.filter((s) => s.status === "aktif").length,
      nonaktif: items.filter((s) => s.status === "nonaktif").length,
    });
  },

  get(req: Request, res: Response) {
    const item = store.findById(String(req.params.id));
    if (!item) throw new ApiError(404, "Supplier tidak ditemukan");
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
      kota,
      syaratPembayaran,
      alamat,
      alamatPengiriman,
      alamatPenagihan,
      namaPIC,
      kontakPIC,
      status,
    } = req.body;

    if (!nama || !tipe || !telepon || !email || !kota || !alamat) {
      throw new ApiError(400, "nama, tipe, telepon, email, kota, dan alamat wajib diisi");
    }

    const item = store.create({
      kode: generateKode(nama),
      nama,
      tipe,
      telepon,
      email,
      npwp: npwp || undefined,
      nik: nik || undefined,
      kota,
      syaratPembayaran: syaratPembayaran || undefined,
      alamat,
      alamatPengiriman: alamatPengiriman || undefined,
      alamatPenagihan: alamatPenagihan || undefined,
      namaPIC: namaPIC || undefined,
      kontakPIC: kontakPIC || undefined,
      status: (status as StatusSupplier) || "aktif",
      createdAt: new Date().toISOString(),
    });
    res.status(201).json(item);
  },

  update(req: Request, res: Response) {
    const item = store.update(String(req.params.id), req.body);
    if (!item) throw new ApiError(404, "Supplier tidak ditemukan");
    res.json(item);
  },

  remove(req: Request, res: Response) {
    const deleted = store.delete(String(req.params.id));
    if (!deleted) throw new ApiError(404, "Supplier tidak ditemukan");
    res.status(204).send();
  },
};
