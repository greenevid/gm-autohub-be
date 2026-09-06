import { Request, Response } from "express";
import { SqliteStore } from "../utils/sqliteStore";
import { generateKode } from "../utils/kodeGenerator";
import { Satuan, StokOpname, StokOpnameItem } from "../models/types";
import { ApiError } from "../middlewares/errorHandler";
import { barangStore } from "./barang.controller";

export const stokOpnameStore = new SqliteStore<StokOpname>("stok_opname");
const store = stokOpnameStore;

async function resolveItems(lokasi: string, rawItems: unknown): Promise<StokOpnameItem[]> {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new ApiError(400, "items tidak boleh kosong");
  }

  const result: StokOpnameItem[] = [];
  for (const raw of rawItems) {
    const input = raw as { itemId?: string; stokFisik?: number };
    if (!input.itemId) throw new ApiError(400, "Setiap item harus memiliki itemId");

    const barang = await barangStore.findById(input.itemId);
    if (!barang) throw new ApiError(400, `Barang dengan id ${input.itemId} tidak ditemukan`);

    const lokasiEntry = barang.stokLokasi.find((sl) => sl.lokasi === lokasi);
    const stokSistem = lokasiEntry?.jumlah ?? 0;
    const stokFisik = Number(input.stokFisik) || 0;

    result.push({
      itemId: barang.id,
      nama: barang.nama,
      kode: barang.kode,
      satuan: lokasiEntry?.satuan ?? barang.satuan,
      stokSistem,
      stokFisik,
      selisih: stokFisik - stokSistem,
    });
  }
  return result;
}

async function applyAdjustments(lokasi: string, items: StokOpnameItem[]) {
  for (const item of items) {
    if (item.selisih === 0) continue;

    await barangStore.updateWithLock(item.itemId, (current) => {
      const hasLokasiEntry = current.stokLokasi.some((sl) => sl.lokasi === lokasi && sl.satuan === item.satuan);
      const stokLokasi = hasLokasiEntry
        ? current.stokLokasi.map((sl) =>
            sl.lokasi === lokasi && sl.satuan === item.satuan ? { ...sl, jumlah: item.stokFisik } : sl
          )
        : [...current.stokLokasi, { satuan: item.satuan as Satuan, lokasi, jumlah: item.stokFisik }];

      return { stok: current.stok + item.selisih, stokLokasi };
    });
  }
}

export const stokOpnameController = {
  async list(_req: Request, res: Response) {
    res.json(await store.findAll());
  },

  async get(req: Request, res: Response) {
    const item = await store.findById(String(req.params.id));
    if (!item) throw new ApiError(404, "Stok opname tidak ditemukan");
    res.json(item);
  },

  async create(req: Request, res: Response) {
    const { tanggal, lokasi, items, catatan } = req.body;
    if (!lokasi) throw new ApiError(400, "lokasi wajib diisi");

    const resolvedItems = await resolveItems(lokasi, items);
    await applyAdjustments(lokasi, resolvedItems);

    const item = await store.create({
      kode: generateKode(
        "SO",
        (await store.findAll()).map((i) => i.kode)
      ),
      tanggal: tanggal || new Date().toISOString(),
      lokasi,
      items: resolvedItems,
      totalSelisihItem: resolvedItems.filter((i) => i.selisih !== 0).length,
      catatan: catatan || undefined,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json(item);
  },

  async remove(req: Request, res: Response) {
    const deleted = await store.delete(String(req.params.id));
    if (!deleted) throw new ApiError(404, "Stok opname tidak ditemukan");
    res.status(204).send();
  },
};
