import { Request, Response } from "express";
import { SqliteStore } from "../utils/sqliteStore";
import { generateKode } from "../utils/kodeGenerator";
import { Retur, ReturItem, StatusRetur } from "../models/types";
import { ApiError } from "../middlewares/errorHandler";
import { computeStatusPembayaran, invoiceNetTotal, invoiceStore } from "./invoice.controller";
import { barangStore } from "./barang.controller";
import { pelangganStore } from "./pelanggan.controller";

const store = new SqliteStore<Retur>("retur");

const VALID_STATUS: StatusRetur[] = ["draft", "ongoing", "selesai"];

function resolveItems(invoiceId: string, rawItems: unknown): ReturItem[] {
  const invoice = invoiceStore.findById(invoiceId);
  if (!invoice) throw new ApiError(400, `Invoice dengan id ${invoiceId} tidak ditemukan`);
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new ApiError(400, "items retur tidak boleh kosong");
  }

  return rawItems.map((raw) => {
    const input = raw as { itemId?: string; qty?: number };
    const invoiceItem = invoice.items.find((i) => i.itemId === input.itemId);
    if (!invoiceItem) {
      throw new ApiError(400, `Item ${input.itemId} tidak ditemukan pada invoice tersebut`);
    }
    const qty = Number(input.qty) || 1;

    return { itemId: invoiceItem.itemId, nama: invoiceItem.nama, qty, hargaSatuan: invoiceItem.hargaSatuan };
  });
}

function restockItems(items: ReturItem[]) {
  for (const item of items) {
    const barang = barangStore.findById(item.itemId);
    if (barang) barangStore.update(barang.id, { stok: barang.stok + item.qty });
  }
}

function computeTotals(items: ReturItem[], potonganPersen = 0, potonganRp = 0, pajakPersen = 0) {
  const subtotal = items.reduce((sum, item) => sum + item.qty * item.hargaSatuan, 0);
  const afterPotongan = Math.max(subtotal * (1 - potonganPersen / 100) - potonganRp, 0);
  const pajak = afterPotongan * (pajakPersen / 100);
  const total = afterPotongan + pajak;
  return { subtotal, pajak, total };
}

function resolveStatus(status: unknown, fallback: StatusRetur): StatusRetur {
  return typeof status === "string" && VALID_STATUS.includes(status as StatusRetur) ? (status as StatusRetur) : fallback;
}

function applyReturToInvoice(invoiceId: string, returAmount: number) {
  const invoice = invoiceStore.findById(invoiceId);
  if (!invoice) return;

  const previousNet = invoiceNetTotal(invoice);
  const previousExcess = Math.max(0, invoice.dibayar - previousNet);

  const newReturTotal = (invoice.returTotal ?? 0) + returAmount;
  const newNet = invoiceNetTotal({ ...invoice, returTotal: newReturTotal });
  const newExcess = Math.max(0, invoice.dibayar - newNet);

  invoiceStore.update(invoice.id, {
    returTotal: newReturTotal,
    statusPembayaran: computeStatusPembayaran(newNet, invoice.dibayar),
  });

  const creditDelta = newExcess - previousExcess;
  if (creditDelta > 0) {
    const pelanggan = pelangganStore.findById(invoice.pelangganId);
    if (pelanggan) {
      pelangganStore.update(pelanggan.id, { saldoKredit: (pelanggan.saldoKredit ?? 0) + creditDelta });
    }
  }
}

export const returController = {
  list(_req: Request, res: Response) {
    res.json(store.findAll());
  },

  get(req: Request, res: Response) {
    const item = store.findById(String(req.params.id));
    if (!item) throw new ApiError(404, "Retur tidak ditemukan");
    res.json(item);
  },

  create(req: Request, res: Response) {
    const { invoiceId, tanggal, alasan, items, potonganPersen, potonganRp, pajakPersen, status } = req.body;
    if (!invoiceId) throw new ApiError(400, "invoiceId wajib diisi");

    const resolvedItems = resolveItems(invoiceId, items);
    const resolvedStatus = resolveStatus(status, "selesai");
    const { subtotal, pajak, total } = computeTotals(resolvedItems, potonganPersen, potonganRp, pajakPersen);

    if (resolvedStatus === "selesai") {
      restockItems(resolvedItems);
      applyReturToInvoice(invoiceId, total);
    }

    const item = store.create({
      kode: generateKode(
        "RTN",
        store.findAll().map((i) => i.kode)
      ),
      invoiceId,
      tanggal: tanggal || new Date().toISOString(),
      alasan,
      items: resolvedItems,
      subtotal,
      potonganPersen,
      potonganRp,
      pajakPersen,
      pajak,
      total,
      status: resolvedStatus,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json(item);
  },

  update(req: Request, res: Response) {
    const existing = store.findById(String(req.params.id));
    if (!existing) throw new ApiError(404, "Retur tidak ditemukan");

    const { alasan, items, potonganPersen, potonganRp, pajakPersen, status } = req.body;
    const resolvedItems = items ? resolveItems(existing.invoiceId, items) : existing.items;
    const resolvedStatus = resolveStatus(status, existing.status);
    const { subtotal, pajak, total } = computeTotals(
      resolvedItems,
      potonganPersen ?? existing.potonganPersen,
      potonganRp ?? existing.potonganRp,
      pajakPersen ?? existing.pajakPersen
    );

    if (resolvedStatus === "selesai" && existing.status !== "selesai") {
      restockItems(resolvedItems);
      applyReturToInvoice(existing.invoiceId, total);
    }

    const updated = store.update(existing.id, {
      alasan: alasan ?? existing.alasan,
      items: resolvedItems,
      subtotal,
      potonganPersen: potonganPersen ?? existing.potonganPersen,
      potonganRp: potonganRp ?? existing.potonganRp,
      pajakPersen: pajakPersen ?? existing.pajakPersen,
      pajak,
      total,
      status: resolvedStatus,
    });
    res.json(updated);
  },

  remove(req: Request, res: Response) {
    const deleted = store.delete(String(req.params.id));
    if (!deleted) throw new ApiError(404, "Retur tidak ditemukan");
    res.status(204).send();
  },
};
