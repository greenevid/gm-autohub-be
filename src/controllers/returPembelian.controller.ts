import { Request, Response } from "express";
import { SqliteStore } from "../utils/sqliteStore";
import { generateKode } from "../utils/kodeGenerator";
import { ReturPembelian, ReturPembelianItem } from "../models/types";
import { ApiError } from "../middlewares/errorHandler";
import { computeStatusPembayaran, pembelianNetTotal, pembelianStore } from "./pembelian.controller";
import { barangStore } from "./barang.controller";
import { supplierStore } from "./supplier.controller";

const store = new SqliteStore<ReturPembelian>("retur_pembelian");

function applyReturToPembelian(pembelianId: string, returAmount: number) {
  const pembelian = pembelianStore.findById(pembelianId);
  if (!pembelian) return;

  const previousNet = pembelianNetTotal(pembelian);
  const previousExcess = Math.max(0, pembelian.dibayar - previousNet);

  const newReturTotal = (pembelian.returTotal ?? 0) + returAmount;
  const newNet = pembelianNetTotal({ ...pembelian, returTotal: newReturTotal });
  const newExcess = Math.max(0, pembelian.dibayar - newNet);

  pembelianStore.update(pembelian.id, {
    returTotal: newReturTotal,
    statusPembayaran: computeStatusPembayaran(newNet, pembelian.dibayar),
  });

  const creditDelta = newExcess - previousExcess;
  if (creditDelta > 0) {
    const supplier = supplierStore.findById(pembelian.supplierId);
    if (supplier) {
      supplierStore.update(supplier.id, { saldoKredit: (supplier.saldoKredit ?? 0) + creditDelta });
    }
  }
}

function resolveItems(pembelianId: string, rawItems: unknown): ReturPembelianItem[] {
  const pembelian = pembelianStore.findById(pembelianId);
  if (!pembelian) throw new ApiError(400, `Pembelian dengan id ${pembelianId} tidak ditemukan`);
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new ApiError(400, "items retur tidak boleh kosong");
  }

  return rawItems.map((raw) => {
    const input = raw as { itemId?: string; qty?: number };
    const pembelianItem = pembelian.items.find((i) => i.itemId === input.itemId);
    if (!pembelianItem) {
      throw new ApiError(400, `Item ${input.itemId} tidak ditemukan pada pembelian tersebut`);
    }
    const qty = Number(input.qty) || 1;

    const barang = barangStore.findById(pembelianItem.itemId);
    if (barang) barangStore.update(barang.id, { stok: barang.stok - qty });

    return { itemId: pembelianItem.itemId, nama: pembelianItem.nama, qty, hargaSatuan: pembelianItem.hargaSatuan };
  });
}

export const returPembelianController = {
  list(_req: Request, res: Response) {
    res.json(store.findAll());
  },

  get(req: Request, res: Response) {
    const item = store.findById(String(req.params.id));
    if (!item) throw new ApiError(404, "Retur pembelian tidak ditemukan");
    res.json(item);
  },

  create(req: Request, res: Response) {
    const { pembelianId, tanggal, alasan, items } = req.body;
    if (!pembelianId) throw new ApiError(400, "pembelianId wajib diisi");

    const resolvedItems = resolveItems(pembelianId, items);
    const total = resolvedItems.reduce((sum, item) => sum + item.qty * item.hargaSatuan, 0);

    applyReturToPembelian(pembelianId, total);

    const item = store.create({
      kode: generateKode(
        "RTP",
        store.findAll().map((i) => i.kode)
      ),
      pembelianId,
      tanggal: tanggal || new Date().toISOString(),
      alasan,
      items: resolvedItems,
      total,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json(item);
  },

  remove(req: Request, res: Response) {
    const deleted = store.delete(String(req.params.id));
    if (!deleted) throw new ApiError(404, "Retur pembelian tidak ditemukan");
    res.status(204).send();
  },
};
