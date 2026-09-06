import { Request, Response } from "express";
import { Barang, BarangStokLokasi, BarangUnit, Satuan, SATUAN_OPTIONS } from "../models/types";
import { SqliteStore } from "../utils/sqliteStore";
import { ApiError } from "../middlewares/errorHandler";
import { paginate, parsePagination } from "../utils/pagination";
import { buildExportWorkbook, buildTemplateWorkbook, ImportSummary, parseSheetRows, sendXlsx } from "../utils/excel";
import { ensureLookup } from "../utils/ensureLookup";
import { supplierStore } from "./supplier.controller";

const TEMPLATE_HEADERS = [
  "Kode",
  "Nama",
  "Kategori",
  "Jenis",
  "Grup",
  "Brand",
  "Model",
  "Supplier",
  "Unit",
  "Harga Beli",
  "Harga Jual",
  "Stok Awal",
  "Deskripsi",
  "Tampil di Booking (Ya/Tidak)",
  "Aktif (Ya/Tidak)",
];
const TEMPLATE_INSTRUCTIONS = [
  "[WAJIB]",
  "[WAJIB]",
  "[WAJIB]",
  "[Opsional]",
  "[Opsional]",
  "[Opsional]",
  "[Opsional]",
  "[Opsional] nama supplier yang sudah terdaftar",
  "[WAJIB] salah satu: " + SATUAN_OPTIONS.join(", "),
  "[Opsional] angka",
  "[Opsional] angka",
  "[Opsional] angka, default 0",
  "[Opsional]",
  "[Opsional] default Tidak",
  "[Opsional] default Ya",
];

export const barangStore = new SqliteStore<Barang>("barang");
const store = barangStore;

function normalizeUnits(rawUnits: unknown): BarangUnit[] {
  if (!Array.isArray(rawUnits) || rawUnits.length === 0) {
    throw new ApiError(400, "Minimal satu unit wajib diisi");
  }
  return rawUnits.map((raw) => {
    const u = raw as Partial<BarangUnit>;
    if (!u.satuan || !SATUAN_OPTIONS.includes(u.satuan)) {
      throw new ApiError(400, `satuan harus salah satu dari: ${SATUAN_OPTIONS.join(", ")}`);
    }
    return {
      satuan: u.satuan,
      hargaBeli: Number(u.hargaBeli) || 0,
      hargaJual: Number(u.hargaJual) || 0,
      conversionFactor: Number(u.conversionFactor) || 1,
      komisi: u.komisi !== undefined && u.komisi !== null && (u.komisi as unknown as string) !== "" ? Number(u.komisi) : undefined,
      barcode: u.barcode || undefined,
      isDefault: Boolean(u.isDefault),
    };
  });
}

function normalizeStokLokasi(rawStokLokasi: unknown): BarangStokLokasi[] {
  if (!Array.isArray(rawStokLokasi)) return [];
  return rawStokLokasi.map((raw) => {
    const s = raw as Partial<BarangStokLokasi>;
    if (!s.satuan || !s.lokasi) throw new ApiError(400, "Setiap baris stok awal harus memiliki satuan dan lokasi");
    return {
      satuan: s.satuan,
      lokasi: s.lokasi,
      rak: s.rak || undefined,
      jumlah: Number(s.jumlah) || 0,
      stokMinimum: s.stokMinimum !== undefined && s.stokMinimum !== null && (s.stokMinimum as unknown as string) !== "" ? Number(s.stokMinimum) : undefined,
      stokMaksimum: s.stokMaksimum !== undefined && s.stokMaksimum !== null && (s.stokMaksimum as unknown as string) !== "" ? Number(s.stokMaksimum) : undefined,
    };
  });
}

export const barangController = {
  list(req: Request, res: Response) {
    const { search, kategori } = req.query;
    let items = store.findAll();

    if (typeof search === "string" && search.trim()) {
      const q = search.trim().toLowerCase();
      items = items.filter((b) => b.kode.toLowerCase().includes(q) || b.nama.toLowerCase().includes(q));
    }
    if (typeof kategori === "string" && kategori) {
      items = items.filter((b) => b.kategori === kategori);
    }

    const { page, limit } = parsePagination(req);
    res.json(paginate(items, page, limit));
  },

  get(req: Request, res: Response) {
    const item = store.findById(String(req.params.id));
    if (!item) throw new ApiError(404, "Barang tidak ditemukan");
    res.json(item);
  },

  create(req: Request, res: Response) {
    const {
      kode,
      nama,
      kategori,
      jenis,
      grup,
      deskripsi,
      brand,
      model,
      supplierId,
      units,
      stokLokasi,
      tampilBooking,
      aktif,
    } = req.body;
    if (!kode || !nama || !kategori) {
      throw new ApiError(400, "kode, nama, dan kategori wajib diisi");
    }

    const normalizedUnits = normalizeUnits(units);
    const defaultUnit = normalizedUnits.find((u) => u.isDefault) ?? normalizedUnits[0];
    const normalizedStokLokasi = normalizeStokLokasi(stokLokasi);
    const totalStok = normalizedStokLokasi.reduce((sum, s) => sum + s.jumlah, 0);

    const item = store.create({
      kode,
      nama,
      kategori,
      jenis: jenis || undefined,
      grup: grup || undefined,
      deskripsi,
      brand,
      model: model || undefined,
      supplierId: supplierId || undefined,
      satuan: defaultUnit.satuan,
      units: normalizedUnits,
      hargaBeli: defaultUnit.hargaBeli,
      hargaJual: defaultUnit.hargaJual,
      stok: totalStok,
      stokLokasi: normalizedStokLokasi,
      tampilBooking: Boolean(tampilBooking),
      aktif: aktif === undefined ? true : Boolean(aktif),
      createdAt: new Date().toISOString(),
    });
    res.status(201).json(item);
  },

  update(req: Request, res: Response) {
    const item = store.update(String(req.params.id), req.body);
    if (!item) throw new ApiError(404, "Barang tidak ditemukan");
    res.json(item);
  },

  remove(req: Request, res: Response) {
    const deleted = store.delete(String(req.params.id));
    if (!deleted) throw new ApiError(404, "Barang tidak ditemukan");
    res.status(204).send();
  },

  template(_req: Request, res: Response) {
    const buffer = buildTemplateWorkbook("Items", TEMPLATE_HEADERS, TEMPLATE_INSTRUCTIONS);
    sendXlsx(res, buffer, "template-barang.xlsx");
  },

  exportXlsx(_req: Request, res: Response) {
    const rows = store.findAll().map((b) => [
      b.kode,
      b.nama,
      b.kategori,
      b.jenis ?? "",
      b.grup ?? "",
      b.brand ?? "",
      b.model ?? "",
      supplierStore.findById(b.supplierId ?? "")?.nama ?? "",
      b.satuan,
      b.hargaBeli,
      b.hargaJual,
      b.stok,
      b.deskripsi ?? "",
      b.tampilBooking ? "Ya" : "Tidak",
      b.aktif ? "Ya" : "Tidak",
    ]);
    const buffer = buildExportWorkbook("Items", TEMPLATE_HEADERS, rows);
    sendXlsx(res, buffer, "data-barang.xlsx");
  },

  importXlsx(req: Request, res: Response) {
    if (!req.file) throw new ApiError(400, "File tidak ditemukan");

    const rows = parseSheetRows(req.file.buffer, "Items");
    const existingKode = new Set(store.findAll().map((b) => b.kode.toLowerCase()));
    const summary: ImportSummary = { created: 0, failed: 0, errors: [] };

    rows.forEach((row, index) => {
      const rowNumber = index + 3; // header + instruction row precede data
      try {
        const kode = row["Kode"];
        const nama = row["Nama"];
        const kategori = row["Kategori"];
        const satuanRaw = row["Unit"].toUpperCase();

        if (!kode || !nama || !kategori) {
          throw new Error("Kode, Nama, dan Kategori wajib diisi");
        }
        if (existingKode.has(kode.toLowerCase())) {
          throw new Error(`Kode "${kode}" sudah dipakai`);
        }
        if (!SATUAN_OPTIONS.includes(satuanRaw as Satuan)) {
          throw new Error(`Unit harus salah satu dari: ${SATUAN_OPTIONS.join(", ")}`);
        }

        const kategoriNama = ensureLookup("kategori", kategori);
        const jenisNama = row["Jenis"] ? ensureLookup("jenis", row["Jenis"]) : undefined;
        const grupNama = row["Grup"] ? ensureLookup("grup", row["Grup"]) : undefined;
        const brandNama = row["Brand"] ? ensureLookup("brand", row["Brand"]) : undefined;
        const modelNama = row["Model"] ? ensureLookup("model", row["Model"]) : undefined;
        const supplier = row["Supplier"]
          ? supplierStore.findAll().find((s) => s.nama.toLowerCase() === row["Supplier"].toLowerCase())
          : undefined;
        if (row["Supplier"] && !supplier) {
          throw new Error(`Supplier "${row["Supplier"]}" tidak ditemukan`);
        }

        const hargaBeli = Number(row["Harga Beli"]) || 0;
        const hargaJual = Number(row["Harga Jual"]) || 0;
        const stokAwal = Number(row["Stok Awal"]) || 0;
        const satuan = satuanRaw as Satuan;

        const unit: BarangUnit = { satuan, hargaBeli, hargaJual, conversionFactor: 1, isDefault: true };
        const stokLokasi: BarangStokLokasi[] =
          stokAwal > 0 ? [{ satuan, lokasi: "Toko", jumlah: stokAwal }] : [];

        store.create({
          kode,
          nama,
          kategori: kategoriNama,
          jenis: jenisNama,
          grup: grupNama,
          brand: brandNama,
          model: modelNama,
          supplierId: supplier?.id,
          deskripsi: row["Deskripsi"] || undefined,
          satuan,
          units: [unit],
          hargaBeli,
          hargaJual,
          stok: stokAwal,
          stokLokasi,
          tampilBooking: row["Tampil di Booking (Ya/Tidak)"].toLowerCase() === "ya",
          aktif: row["Aktif (Ya/Tidak)"].toLowerCase() !== "tidak",
          createdAt: new Date().toISOString(),
        });
        existingKode.add(kode.toLowerCase());
        summary.created += 1;
      } catch (err) {
        summary.failed += 1;
        summary.errors.push({ row: rowNumber, message: err instanceof Error ? err.message : "Baris tidak valid" });
      }
    });

    res.json(summary);
  },
};
