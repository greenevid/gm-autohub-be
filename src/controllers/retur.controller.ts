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

async function resolveItems(invoiceId: string, rawItems: unknown): Promise<ReturItem[]> {
  const invoice = await invoiceStore.findById(invoiceId);
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

async function restockItems(items: ReturItem[]) {
  for (const item of items) {
    await barangStore.updateWithLock(item.itemId, (current) => ({ stok: current.stok + item.qty }));
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

async function applyReturToInvoice(invoiceId: string, returAmount: number) {
  let creditDelta = 0;
  let pelangganId: string | undefined;

  const updated = await invoiceStore.updateWithLock(invoiceId, (current) => {
    const previousNet = invoiceNetTotal(current);
    const previousExcess = Math.max(0, current.dibayar - previousNet);

    const newReturTotal = (current.returTotal ?? 0) + returAmount;
    const newNet = invoiceNetTotal({ ...current, returTotal: newReturTotal });
    const newExcess = Math.max(0, current.dibayar - newNet);

    creditDelta = newExcess - previousExcess;
    pelangganId = current.pelangganId;

    return {
      returTotal: newReturTotal,
      statusPembayaran: computeStatusPembayaran(newNet, current.dibayar),
    };
  });
  if (!updated || !pelangganId) return;

  if (creditDelta > 0) {
    await pelangganStore.updateWithLock(pelangganId, (current) => ({
      saldoKredit: (current.saldoKredit ?? 0) + creditDelta,
    }));
  }
}

export const returController = {
  async list(_req: Request, res: Response) {
    res.json(await store.findAll());
  },

  async get(req: Request, res: Response) {
    const item = await store.findById(String(req.params.id));
    if (!item) throw new ApiError(404, "Retur tidak ditemukan");
    res.json(item);
  },

  async create(req: Request, res: Response) {
    const { invoiceId, tanggal, alasan, items, potonganPersen, potonganRp, pajakPersen, status } = req.body;
    if (!invoiceId) throw new ApiError(400, "invoiceId wajib diisi");

    const resolvedItems = await resolveItems(invoiceId, items);
    const resolvedStatus = resolveStatus(status, "selesai");
    const { subtotal, pajak, total } = computeTotals(resolvedItems, potonganPersen, potonganRp, pajakPersen);

    if (resolvedStatus === "selesai") {
      await restockItems(resolvedItems);
      await applyReturToInvoice(invoiceId, total);
    }

    const item = await store.create({
      kode: generateKode(
        "RTN",
        (await store.findAll()).map((i) => i.kode)
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

  async update(req: Request, res: Response) {
    const existing = await store.findById(String(req.params.id));
    if (!existing) throw new ApiError(404, "Retur tidak ditemukan");

    const { alasan, items, potonganPersen, potonganRp, pajakPersen, status } = req.body;
    const resolvedItems = items ? await resolveItems(existing.invoiceId, items) : existing.items;
    const resolvedStatus = resolveStatus(status, existing.status);
    const { subtotal, pajak, total } = computeTotals(
      resolvedItems,
      potonganPersen ?? existing.potonganPersen,
      potonganRp ?? existing.potonganRp,
      pajakPersen ?? existing.pajakPersen
    );

    if (resolvedStatus === "selesai" && existing.status !== "selesai") {
      await restockItems(resolvedItems);
      await applyReturToInvoice(existing.invoiceId, total);
    }

    const updated = await store.update(existing.id, {
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

  async remove(req: Request, res: Response) {
    const deleted = await store.delete(String(req.params.id));
    if (!deleted) throw new ApiError(404, "Retur tidak ditemukan");
    res.status(204).send();
  },
};
