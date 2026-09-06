import { Request, Response } from "express";
import { randomBytes } from "crypto";
import { SqliteStore } from "../utils/sqliteStore";
import { Karyawan, SatuanGaji, StatusKaryawan } from "../models/types";
import { ApiError } from "../middlewares/errorHandler";

const store = new SqliteStore<Karyawan>("karyawan");

function randomCode(length: number): string {
  return randomBytes(length).toString("hex").toUpperCase().slice(0, length);
}

function generateKode(): string {
  return `EMP-${randomCode(2)}-${randomCode(4)}`;
}

export const karyawanController = {
  list(req: Request, res: Response) {
    const { search, posisiId, status } = req.query;
    let items = store.findAll();

    if (typeof search === "string" && search.trim()) {
      const q = search.trim().toLowerCase();
      items = items.filter(
        (k) =>
          k.kode.toLowerCase().includes(q) ||
          k.nama.toLowerCase().includes(q) ||
          (k.email ?? "").toLowerCase().includes(q) ||
          (k.telepon ?? "").toLowerCase().includes(q)
      );
    }
    if (typeof posisiId === "string" && posisiId) {
      items = items.filter((k) => k.posisiId === posisiId);
    }
    if (typeof status === "string" && status) {
      items = items.filter((k) => k.status === status);
    }

    res.json(items);
  },

  stats(_req: Request, res: Response) {
    const items = store.findAll();
    res.json({
      total: items.length,
      aktif: items.filter((k) => k.status === "aktif").length,
      nonaktif: items.filter((k) => k.status === "nonaktif").length,
    });
  },

  get(req: Request, res: Response) {
    const item = store.findById(String(req.params.id));
    if (!item) throw new ApiError(404, "Karyawan tidak ditemukan");
    res.json(item);
  },

  create(req: Request, res: Response) {
    const { nama, email, telepon, nik, alamat, posisiId, tanggalMasuk, satuanGaji, gaji, status } = req.body;

    if (!nama || !tanggalMasuk) {
      throw new ApiError(400, "nama dan tanggalMasuk wajib diisi");
    }

    const item = store.create({
      kode: generateKode(),
      nama,
      email: email || undefined,
      telepon: telepon || undefined,
      nik: nik || undefined,
      alamat: alamat || undefined,
      posisiId: posisiId || undefined,
      tanggalMasuk,
      satuanGaji: (satuanGaji as SatuanGaji) || "per_bulan",
      gaji: Number(gaji) || 0,
      status: (status as StatusKaryawan) || "aktif",
      createdAt: new Date().toISOString(),
    });
    res.status(201).json(item);
  },

  update(req: Request, res: Response) {
    const item = store.update(String(req.params.id), req.body);
    if (!item) throw new ApiError(404, "Karyawan tidak ditemukan");
    res.json(item);
  },

  remove(req: Request, res: Response) {
    const deleted = store.delete(String(req.params.id));
    if (!deleted) throw new ApiError(404, "Karyawan tidak ditemukan");
    res.status(204).send();
  },
};
