import { Request, Response } from "express";
import { SqliteStore } from "../utils/sqliteStore";
import { generateKode } from "../utils/kodeGenerator";
import { Satuan, StokOpname, StokOpnameItem } from "../models/types";
import { ApiError } from "../middlewares/errorHandler";
import { barangStore } from "./barang.controller";

export const stokOpnameStore = new SqliteStore<StokOpname>("stok_opname");
const store = stokOpnameStore;

function resolveItems(lokasi: string, rawItems: unknown): StokOpnameItem[] {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new ApiError(400, "items tidak boleh kosong");
  }

  return rawItems.map((raw) => {
    const input = raw as { itemId?: string; stokFisik?: number };
    if (!input.itemId) throw new ApiError(400, "Setiap item harus memiliki itemId");

    const barang = barangStore.findById(input.itemId);
    if (!barang) throw new ApiError(400, `Barang dengan id ${input.itemId} tidak ditemukan`);

    const lokasiEntry = barang.stokLokasi.find((sl) => sl.lokasi === lokasi);
    const stokSistem = lokasiEntry?.jumlah ?? 0;
    const stokFisik = Number(input.stokFisik) || 0;

    return {
      itemId: barang.id,
      nama: barang.nama,
      kode: barang.kode,
      satuan: lokasiEntry?.satuan ?? barang.satuan,
      stokSistem,
      stokFisik,
      selisih: stokFisik - stokSistem,
    };
  });
}

function applyAdjustments(lokasi: string, items: StokOpnameItem[]) {
  for (const item of items) {
    if (item.selisih === 0) continue;
    const barang = barangStore.findById(item.itemId);
    if (!barang) continue;

    const hasLokasiEntry = barang.stokLokasi.some((sl) => sl.lokasi === lokasi && sl.satuan === item.satuan);
    const stokLokasi = hasLokasiEntry
      ? barang.stokLokasi.map((sl) =>
          sl.lokasi === lokasi && sl.satuan === item.satuan ? { ...sl, jumlah: item.stokFisik } : sl
        )
      : [...barang.stokLokasi, { satuan: item.satuan as Satuan, lokasi, jumlah: item.stokFisik }];

    barangStore.update(barang.id, { stok: barang.stok + item.selisih, stokLokasi });
  }
}

export const stokOpnameController = {
  list(_req: Request, res: Response) {
    res.json(store.findAll());
  },

  get(req: Request, res: Response) {
    const item = store.findById(String(req.params.id));
    if (!item) throw new ApiError(404, "Stok opname tidak ditemukan");
    res.json(item);
  },

  create(req: Request, res: Response) {
    const { tanggal, lokasi, items, catatan } = req.body;
    if (!lokasi) throw new ApiError(400, "lokasi wajib diisi");

    const resolvedItems = resolveItems(lokasi, items);
    applyAdjustments(lokasi, resolvedItems);

    const item = store.create({
      kode: generateKode(
        "SO",
        store.findAll().map((i) => i.kode)
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

  remove(req: Request, res: Response) {
    const deleted = store.delete(String(req.params.id));
    if (!deleted) throw new ApiError(404, "Stok opname tidak ditemukan");
    res.status(204).send();
  },
};
