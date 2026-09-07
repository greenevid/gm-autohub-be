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

async function generateKode(nama: string): Promise<string> {
  const base = `SUP-${slugify(nama) || "SUPPLIER"}`;
  const existingCodes = (await store.findAll()).map((s) => s.kode);
  if (!existingCodes.includes(base)) return base;
  let suffix = 2;
  while (existingCodes.includes(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

/**
 * Finds a supplier by name (case-insensitive) or auto-creates a bare-minimum
 * record with just the name — used by imports where only "nama" is known.
 * The other fields required by the create endpoint are left blank; they can
 * be filled in later from the Supplier menu.
 */
export async function ensureSupplier(nama: string): Promise<Supplier> {
  const trimmed = nama.trim();
  const all = await store.findAll();
  const existing = all.find((s) => s.nama.toLowerCase() === trimmed.toLowerCase());
  if (existing) return existing;
  return store.create({
    kode: await generateKode(trimmed),
    nama: trimmed,
    tipe: "",
    telepon: "",
    email: "",
    kota: "",
    alamat: "",
    status: "aktif",
    createdAt: new Date().toISOString(),
  });
}

export const supplierController = {
  async list(req: Request, res: Response) {
    const { search, status } = req.query;
    let items = await store.findAll();

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

  async stats(_req: Request, res: Response) {
    const items = await store.findAll();
    res.json({
      total: items.length,
      aktif: items.filter((s) => s.status === "aktif").length,
      nonaktif: items.filter((s) => s.status === "nonaktif").length,
    });
  },

  async get(req: Request, res: Response) {
    const item = await store.findById(String(req.params.id));
    if (!item) throw new ApiError(404, "Supplier tidak ditemukan");
    res.json(item);
  },

  async create(req: Request, res: Response) {
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

    if (!nama) {
      throw new ApiError(400, "nama wajib diisi");
    }

    const item = await store.create({
      kode: await generateKode(nama),
      nama,
      tipe: tipe || "",
      telepon: telepon || "",
      email: email || "",
      npwp: npwp || undefined,
      nik: nik || undefined,
      kota: kota || "",
      syaratPembayaran: syaratPembayaran || undefined,
      alamat: alamat || "",
      alamatPengiriman: alamatPengiriman || undefined,
      alamatPenagihan: alamatPenagihan || undefined,
      namaPIC: namaPIC || undefined,
      kontakPIC: kontakPIC || undefined,
      status: (status as StatusSupplier) || "aktif",
      createdAt: new Date().toISOString(),
    });
    res.status(201).json(item);
  },

  async update(req: Request, res: Response) {
    const item = await store.update(String(req.params.id), req.body);
    if (!item) throw new ApiError(404, "Supplier tidak ditemukan");
    res.json(item);
  },

  async remove(req: Request, res: Response) {
    const deleted = await store.delete(String(req.params.id));
    if (!deleted) throw new ApiError(404, "Supplier tidak ditemukan");
    res.status(204).send();
  },
};
