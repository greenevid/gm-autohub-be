import { Request, Response } from "express";
import { SqliteStore } from "../utils/sqliteStore";
import { generateKode } from "../utils/kodeGenerator";
import { PengeluaranBarang, PengeluaranBarangItem, StatusPengeluaranBarang } from "../models/types";
import { ApiError } from "../middlewares/errorHandler";
import { barangStore } from "./barang.controller";

export const pengeluaranBarangStore = new SqliteStore<PengeluaranBarang>("pengeluaran_barang");
const store = pengeluaranBarangStore;

const VALID_STATUS: StatusPengeluaranBarang[] = ["draft", "terposting"];

function resolveItems(rawItems: unknown): PengeluaranBarangItem[] {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new ApiError(400, "Detail item tidak boleh kosong");
  }

  return rawItems.map((raw) => {
    const input = raw as {
      itemId?: string;
      satuan?: string;
      lokasi?: string;
      jumlah?: number;
      hargaSatuan?: number;
      catatan?: string;
    };
    if (!input.itemId) throw new ApiError(400, "Setiap item harus memiliki itemId");
    if (!input.lokasi) throw new ApiError(400, "Setiap item harus memiliki lokasi");

    const barang = barangStore.findById(input.itemId);
    if (!barang) throw new ApiError(400, `Barang dengan id ${input.itemId} tidak ditemukan`);

    const jumlah = Number(input.jumlah) || 0;
    if (jumlah <= 0) throw new ApiError(400, `Jumlah untuk ${barang.nama} harus lebih dari 0`);

    return {
      itemId: barang.id,
      nama: barang.nama,
      kode: barang.kode,
      satuan: input.satuan || barang.satuan,
      lokasi: input.lokasi,
      jumlah,
      hargaSatuan: Number(input.hargaSatuan) > 0 ? Number(input.hargaSatuan) : undefined,
      catatan: input.catatan || undefined,
    };
  });
}

function ensureStockAvailable(items: PengeluaranBarangItem[]) {
  for (const item of items) {
    const barang = barangStore.findById(item.itemId);
    if (!barang) continue;
    const entry = barang.stokLokasi.find((sl) => sl.lokasi === item.lokasi && sl.satuan === item.satuan);
    const tersedia = entry?.jumlah ?? 0;
    if (item.jumlah > tersedia) {
      throw new ApiError(
        400,
        `Stok ${item.nama} di ${item.lokasi} tidak mencukupi (tersedia ${tersedia}, diminta ${item.jumlah})`
      );
    }
  }
}

function applyStockOut(items: PengeluaranBarangItem[]) {
  for (const item of items) {
    const barang = barangStore.findById(item.itemId);
    if (!barang) continue;

    const stokLokasi = barang.stokLokasi.map((sl) =>
      sl.lokasi === item.lokasi && sl.satuan === item.satuan ? { ...sl, jumlah: sl.jumlah - item.jumlah } : sl
    );

    barangStore.update(barang.id, { stok: barang.stok - item.jumlah, stokLokasi });
  }
}

export const pengeluaranBarangController = {
  list(_req: Request, res: Response) {
    res.json(store.findAll());
  },

  get(req: Request, res: Response) {
    const item = store.findById(String(req.params.id));
    if (!item) throw new ApiError(404, "Pengeluaran barang tidak ditemukan");
    res.json(item);
  },

  create(req: Request, res: Response) {
    const { tanggal, alasan, catatan, items, status } = req.body;
    if (!alasan) throw new ApiError(400, "Alasan wajib diisi");

    const resolvedItems = resolveItems(items);
    const finalStatus: StatusPengeluaranBarang = status && VALID_STATUS.includes(status) ? status : "terposting";
    if (finalStatus === "terposting") {
      ensureStockAvailable(resolvedItems);
      applyStockOut(resolvedItems);
    }

    const item = store.create({
      kode: generateKode(
        "GI",
        store.findAll().map((i) => i.kode)
      ),
      tanggal: tanggal || new Date().toISOString(),
      alasan,
      catatan: catatan || undefined,
      items: resolvedItems,
      status: finalStatus,
      dibuatOleh: req.authUser?.nama,
      postedAt: finalStatus === "terposting" ? new Date().toISOString() : undefined,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json(item);
  },

  update(req: Request, res: Response) {
    const existing = store.findById(String(req.params.id));
    if (!existing) throw new ApiError(404, "Pengeluaran barang tidak ditemukan");

    const { status } = req.body;
    if (status !== undefined && !VALID_STATUS.includes(status)) {
      throw new ApiError(400, `status harus salah satu dari: ${VALID_STATUS.join(", ")}`);
    }

    const patch: Partial<PengeluaranBarang> = {};
    if (status === "terposting" && existing.status === "draft") {
      ensureStockAvailable(existing.items);
      applyStockOut(existing.items);
      patch.status = "terposting";
      patch.postedAt = new Date().toISOString();
    }

    const item = store.update(existing.id, patch);
    res.json(item);
  },

  remove(req: Request, res: Response) {
    const deleted = store.delete(String(req.params.id));
    if (!deleted) throw new ApiError(404, "Pengeluaran barang tidak ditemukan");
    res.status(204).send();
  },
};
