import { Request, Response } from "express";
import { SqliteStore } from "../utils/sqliteStore";
import { generateKode } from "../utils/kodeGenerator";
import { PajakSetting, Pembelian, PembelianItem, StatusPembayaran, StatusPembelian } from "../models/types";
import { ApiError } from "../middlewares/errorHandler";
import { barangStore } from "./barang.controller";
import { pajakSettings } from "./pengaturan.controller";

export const pembelianStore = new SqliteStore<Pembelian>("pembelian");
const store = pembelianStore;

const VALID_STATUS: StatusPembelian[] = ["selesai", "draft", "dibatalkan"];

async function resolveItems(rawItems: unknown): Promise<PembelianItem[]> {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new ApiError(400, "items tidak boleh kosong");
  }

  const result: PembelianItem[] = [];
  for (const raw of rawItems) {
    const input = raw as {
      itemId?: string;
      qty?: number;
      diskonPersen?: number;
      hargaSatuan?: number;
      lokasi?: string;
      satuan?: string;
    };
    if (!input.itemId) throw new ApiError(400, "Setiap item harus memiliki itemId");

    const qty = Number(input.qty) || 1;
    const diskonPersen = Number(input.diskonPersen) || 0;
    const hargaOverride = Number(input.hargaSatuan) > 0 ? Number(input.hargaSatuan) : undefined;
    const lokasi = input.lokasi || undefined;
    const satuan = input.satuan || undefined;

    const barang = await barangStore.findById(input.itemId);
    if (!barang) throw new ApiError(400, `Barang dengan id ${input.itemId} tidak ditemukan`);
    await barangStore.updateWithLock(barang.id, (current) => ({ stok: current.stok + qty }));
    result.push({
      itemId: barang.id,
      nama: barang.nama,
      kode: barang.kode,
      satuan,
      qty,
      hargaSatuan: hargaOverride ?? barang.hargaBeli,
      diskonPersen,
      lokasi,
    });
  }
  return result;
}

function roundToNearest(value: number, step: number) {
  if (!step) return value;
  return Math.round(value / step) * step;
}

function computeTotals(items: PembelianItem[], potonganPersen: number, pajak: PajakSetting) {
  const subtotal = items.reduce((sum, item) => sum + item.qty * item.hargaSatuan * (1 - item.diskonPersen / 100), 0);
  const dpp = subtotal * (1 - potonganPersen / 100);
  const pajakPersen = pajak.aktif ? pajak.persentase : 0;
  const pajakNominal = roundToNearest(dpp * (pajakPersen / 100), pajak.pembulatan);
  return { subtotal, dpp, pajakPersen, pajak: pajakNominal };
}

export function computeStatusPembayaran(total: number, dibayar: number): StatusPembayaran {
  if (total <= 0) return "lunas";
  if (dibayar <= 0) return "belum_dibayar";
  if (dibayar >= total) return "lunas";
  return "dibayar_setengah";
}

export function pembelianNetTotal(pembelian: Pembelian): number {
  return Math.max(0, pembelian.total - (pembelian.returTotal ?? 0));
}

export const pembelianController = {
  async list(_req: Request, res: Response) {
    res.json(await store.findAll());
  },

  async get(req: Request, res: Response) {
    const item = await store.findById(String(req.params.id));
    if (!item) throw new ApiError(404, "Pembelian tidak ditemukan");
    res.json(item);
  },

  async create(req: Request, res: Response) {
    const {
      supplierId,
      tanggal,
      items,
      status,
      dibayar,
      jatuhTempoHari,
      jatuhTempo: jatuhTempoOverride,
      syaratPembayaran,
      noInvoiceSupplier,
      catatan,
      potonganPersen,
      biayaPengiriman,
      biayaLainnya,
      metodePembayaran,
      catatanPembayaran,
    } = req.body;
    if (!supplierId) throw new ApiError(400, "supplierId wajib diisi");

    const resolvedItems = await resolveItems(items);
    const potongan = Number(potonganPersen) || 0;
    const ongkir = Number(biayaPengiriman) || 0;
    const lainnya = Number(biayaLainnya) || 0;
    const { subtotal, dpp, pajakPersen, pajak } = computeTotals(resolvedItems, potongan, await pajakSettings.get());
    const total = dpp + pajak + ongkir + lainnya;
    const paid = Number(dibayar) || 0;

    const tanggalPembelian = tanggal || new Date().toISOString();
    let jatuhTempo: string;
    if (jatuhTempoOverride) {
      jatuhTempo = new Date(jatuhTempoOverride).toISOString();
    } else {
      const hariTempo = jatuhTempoHari === undefined ? 30 : Number(jatuhTempoHari);
      jatuhTempo = new Date(new Date(tanggalPembelian).getTime() + hariTempo * 24 * 60 * 60 * 1000).toISOString();
    }

    const item = await store.create({
      kode: generateKode(
        "PB",
        (await store.findAll()).map((i) => i.kode)
      ),
      supplierId,
      tanggal: tanggalPembelian,
      jatuhTempo,
      syaratPembayaran: syaratPembayaran || undefined,
      noInvoiceSupplier: noInvoiceSupplier || undefined,
      catatan: catatan || undefined,
      metodePembayaran: metodePembayaran || undefined,
      catatanPembayaran: catatanPembayaran || undefined,
      items: resolvedItems,
      potonganPersen: potongan,
      subtotal,
      dpp,
      pajakPersen,
      pajak,
      biayaPengiriman: ongkir,
      biayaLainnya: lainnya,
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
    if (!existing) throw new ApiError(404, "Pembelian tidak ditemukan");

    const { status, dibayar, ...rest } = req.body;
    const patch: Partial<Pembelian> = { ...rest };

    if (status !== undefined) {
      if (!VALID_STATUS.includes(status)) {
        throw new ApiError(400, `status harus salah satu dari: ${VALID_STATUS.join(", ")}`);
      }
      patch.status = status;
    }

    if (dibayar !== undefined) {
      patch.dibayar = Number(dibayar) || 0;
      patch.statusPembayaran = computeStatusPembayaran(pembelianNetTotal(existing), patch.dibayar);
    }

    const item = await store.update(existing.id, patch);
    res.json(item);
  },

  async remove(req: Request, res: Response) {
    const deleted = await store.delete(String(req.params.id));
    if (!deleted) throw new ApiError(404, "Pembelian tidak ditemukan");
    res.status(204).send();
  },
};
