import { Request, Response } from "express";
import { SqliteStore } from "../utils/sqliteStore";
import { PeriodeGaji, PeriodeGajiRow } from "../models/types";
import { ApiError } from "../middlewares/errorHandler";

const store = new SqliteStore<PeriodeGaji>("periode_gaji");

export const periodeGajiController = {
  async list(_req: Request, res: Response) {
    const items = (await store.findAll()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    res.json(items);
  },

  async get(req: Request, res: Response) {
    const item = await store.findById(String(req.params.id));
    if (!item) throw new ApiError(404, "Periode gaji tidak ditemukan");
    res.json(item);
  },

  async create(req: Request, res: Response) {
    const { nama, catatan, tanggalMulai, tanggalSelesai, tipe, rows } = req.body;

    if (!nama || !tanggalMulai || !tanggalSelesai || !Array.isArray(rows) || rows.length === 0) {
      throw new ApiError(400, "nama, tanggalMulai, tanggalSelesai, dan rows wajib diisi");
    }

    const normalizedRows: PeriodeGajiRow[] = rows.map((row: PeriodeGajiRow) => ({
      karyawanId: row.karyawanId,
      namaKaryawan: row.namaKaryawan,
      posisiNama: row.posisiNama || undefined,
      satuanGaji: row.satuanGaji,
      gajiPokok: Number(row.gajiPokok) || 0,
      komisi: Number(row.komisi) || 0,
      potongan: Number(row.potongan) || 0,
      totalTerima: (Number(row.gajiPokok) || 0) + (Number(row.komisi) || 0) - (Number(row.potongan) || 0),
    }));

    const totalGaji = normalizedRows.reduce((sum, r) => sum + r.gajiPokok, 0);
    const totalKomisi = normalizedRows.reduce((sum, r) => sum + r.komisi, 0);
    const totalPotongan = normalizedRows.reduce((sum, r) => sum + r.potongan, 0);

    const item = await store.create({
      nama,
      catatan: catatan || undefined,
      tanggalMulai,
      tanggalSelesai,
      tipe: tipe || "semua",
      rows: normalizedRows,
      totalGaji,
      totalKomisi,
      totalPotongan,
      totalKeseluruhan: totalGaji + totalKomisi - totalPotongan,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json(item);
  },

  async remove(req: Request, res: Response) {
    const deleted = await store.delete(String(req.params.id));
    if (!deleted) throw new ApiError(404, "Periode gaji tidak ditemukan");
    res.status(204).send();
  },
};
