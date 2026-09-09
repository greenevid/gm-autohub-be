import { Request, Response } from "express";
import { SqliteStore } from "../utils/sqliteStore";
import { generateKode } from "../utils/kodeGenerator";
import { Invoice, InvoiceItem, PajakSetting, StatusInvoice, StatusPembayaran } from "../models/types";
import { ApiError } from "../middlewares/errorHandler";
import { barangStore } from "./barang.controller";
import { jasaStore } from "./jasa.controller";
import { pajakSettings } from "./pengaturan.controller";
import { hitungTotalSetelahDiskon } from "../utils/diskon";

export const invoiceStore = new SqliteStore<Invoice>("invoice");
const store = invoiceStore;

const VALID_STATUS: StatusInvoice[] = ["selesai", "draft", "dibatalkan"];

async function resolveItems(rawItems: unknown): Promise<InvoiceItem[]> {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new ApiError(400, "items tidak boleh kosong");
  }

  const result: InvoiceItem[] = [];
  for (const raw of rawItems) {
    const input = raw as {
      tipe?: string;
      itemId?: string;
      qty?: number;
      diskonTipe?: "persen" | "rupiah";
      diskonPersen?: number;
      diskonRp?: number;
      hargaSatuan?: number;
      lokasi?: string;
      satuan?: string;
    };
    if ((input.tipe !== "barang" && input.tipe !== "jasa") || !input.itemId) {
      throw new ApiError(400, "Setiap item harus memiliki tipe (barang/jasa) dan itemId");
    }

    const qty = Number(input.qty) || 1;
    const diskonTipe: "persen" | "rupiah" = input.diskonTipe === "rupiah" ? "rupiah" : "persen";
    const diskonPersen = Number(input.diskonPersen) || 0;
    const diskonRp = Number(input.diskonRp) || 0;
    const hargaOverride = Number(input.hargaSatuan) > 0 ? Number(input.hargaSatuan) : undefined;
    const lokasi = input.lokasi || undefined;

    if (input.tipe === "barang") {
      const barang = await barangStore.findById(input.itemId);
      if (!barang) throw new ApiError(400, `Barang dengan id ${input.itemId} tidak ditemukan`);
      await barangStore.updateWithLock(barang.id, (current) => ({ stok: current.stok - qty }));
      result.push({
        tipe: "barang",
        itemId: barang.id,
        nama: barang.nama,
        kode: barang.kode,
        satuan: input.satuan || undefined,
        qty,
        hargaSatuan: hargaOverride ?? barang.hargaJual,
        diskonTipe,
        diskonPersen,
        diskonRp,
        lokasi,
      });
      continue;
    }

    const jasa = await jasaStore.findById(input.itemId);
    if (!jasa) throw new ApiError(400, `Jasa dengan id ${input.itemId} tidak ditemukan`);
    result.push({
      tipe: "jasa",
      itemId: jasa.id,
      nama: jasa.nama,
      kode: jasa.kode,
      qty,
      hargaSatuan: hargaOverride ?? jasa.harga,
      diskonTipe,
      diskonPersen,
      diskonRp,
    });
  }
  return result;
}

function roundToNearest(value: number, step: number) {
  if (!step) return value;
  return Math.round(value / step) * step;
}

function computeTotals(items: InvoiceItem[], potonganPersen: number, pajak: PajakSetting) {
  const subtotal = items.reduce(
    (sum, item) =>
      sum + hitungTotalSetelahDiskon(item.qty * item.hargaSatuan, item.diskonTipe, item.diskonPersen, item.diskonRp ?? 0),
    0
  );
  const dpp = subtotal * (1 - potonganPersen / 100);
  const pajakPersen = pajak.aktif ? pajak.persentase : 0;
  const pajakNominal = roundToNearest(dpp * (pajakPersen / 100), pajak.pembulatan);
  const total = dpp + pajakNominal;
  return { subtotal, dpp, pajakPersen, pajak: pajakNominal, total };
}

export function computeStatusPembayaran(total: number, dibayar: number): StatusPembayaran {
  if (total <= 0) return "lunas";
  if (dibayar <= 0) return "belum_dibayar";
  if (dibayar >= total) return "lunas";
  return "dibayar_setengah";
}

export function invoiceNetTotal(invoice: Invoice): number {
  return Math.max(0, invoice.total - (invoice.returTotal ?? 0));
}

export const invoiceController = {
  async list(_req: Request, res: Response) {
    res.json(await store.findAll());
  },

  async get(req: Request, res: Response) {
    const item = await store.findById(String(req.params.id));
    if (!item) throw new ApiError(404, "Invoice tidak ditemukan");
    res.json(item);
  },

  async create(req: Request, res: Response) {
    const {
      pelangganId,
      kendaraanIds,
      kilometer,
      tanggal,
      items,
      status,
      dibayar,
      jatuhTempoHari,
      jatuhTempo: jatuhTempoOverride,
      syaratPembayaran,
      catatan,
      keluhan,
      potonganPersen,
    } = req.body;
    if (!pelangganId) throw new ApiError(400, "pelangganId wajib diisi");

    const resolvedItems = await resolveItems(items);
    const potongan = Number(potonganPersen) || 0;
    const { subtotal, dpp, pajakPersen, pajak, total } = computeTotals(
      resolvedItems,
      potongan,
      await pajakSettings.get()
    );
    const paid = Number(dibayar) || 0;

    const tanggalInvoice = tanggal || new Date().toISOString();
    let jatuhTempo: string;
    if (jatuhTempoOverride) {
      jatuhTempo = new Date(jatuhTempoOverride).toISOString();
    } else {
      const hariTempo = jatuhTempoHari === undefined ? 30 : Number(jatuhTempoHari);
      jatuhTempo = new Date(new Date(tanggalInvoice).getTime() + hariTempo * 24 * 60 * 60 * 1000).toISOString();
    }

    const item = await store.create({
      kode: generateKode(
        "SL",
        (await store.findAll()).map((i) => i.kode)
      ),
      pelangganId,
      kendaraanIds: Array.isArray(kendaraanIds) ? kendaraanIds.filter((id) => typeof id === "string") : undefined,
      kilometer: Number(kilometer) > 0 ? Number(kilometer) : undefined,
      tanggal: tanggalInvoice,
      jatuhTempo,
      syaratPembayaran: syaratPembayaran || undefined,
      catatan: catatan || undefined,
      keluhan: keluhan || undefined,
      items: resolvedItems,
      potonganPersen: potongan,
      subtotal,
      dpp,
      pajakPersen,
      pajak,
      total,
      dibayar: paid,
      status: status && VALID_STATUS.includes(status) ? status : "selesai",
      statusPembayaran: computeStatusPembayaran(total, paid),
      createdAt: new Date().toISOString(),
    });
    res.status(201).json(item);
  },

  async update(req: Request, res: Response) {
    const existing = await store.findById(String(req.params.id));
    if (!existing) throw new ApiError(404, "Invoice tidak ditemukan");

    const { status, dibayar, ...rest } = req.body;
    const patch: Partial<Invoice> = { ...rest };

    if (status !== undefined) {
      if (!VALID_STATUS.includes(status)) {
        throw new ApiError(400, `status harus salah satu dari: ${VALID_STATUS.join(", ")}`);
      }
      patch.status = status;
    }

    if (dibayar !== undefined) {
      patch.dibayar = Number(dibayar) || 0;
      patch.statusPembayaran = computeStatusPembayaran(invoiceNetTotal(existing), patch.dibayar);
    }

    const item = await store.update(existing.id, patch);
    res.json(item);
  },

  async remove(req: Request, res: Response) {
    const deleted = await store.delete(String(req.params.id));
    if (!deleted) throw new ApiError(404, "Invoice tidak ditemukan");
    res.status(204).send();
  },
};
