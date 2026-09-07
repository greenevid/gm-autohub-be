import { Request, Response } from "express";
import { SqliteStore } from "../utils/sqliteStore";
import { Jasa } from "../models/types";
import { ApiError } from "../middlewares/errorHandler";
import { paginate, parsePagination } from "../utils/pagination";
import { buildExportWorkbook, buildTemplateWorkbook, ImportSummary, parseSheetRows, sendXlsx } from "../utils/excel";
import { ensureLookup } from "../utils/ensureLookup";

export const jasaStore = new SqliteStore<Jasa>("jasa");
const store = jasaStore;

const TEMPLATE_HEADERS = [
  "Kode",
  "Nama",
  "Kategori",
  "Jenis",
  "Model",
  "Harga Jual",
  "Komisi (%)",
  "Deskripsi",
  "Tampil di Booking (Ya/Tidak)",
  "Aktif (Ya/Tidak)",
];
const TEMPLATE_INSTRUCTIONS = [
  "[WAJIB]",
  "[WAJIB]",
  "[WAJIB]",
  "[WAJIB]",
  "[Opsional]",
  "[Opsional] angka, default 0",
  "[Opsional] angka, default 10",
  "[Opsional]",
  "[Opsional] default Tidak",
  "[Opsional] default Ya",
];

export const jasaController = {
  async list(req: Request, res: Response) {
    const { search, kategori } = req.query;
    let items = await store.findAll();

    if (typeof search === "string" && search.trim()) {
      const q = search.trim().toLowerCase();
      items = items.filter((j) => j.kode.toLowerCase().includes(q) || j.nama.toLowerCase().includes(q));
    }
    if (typeof kategori === "string" && kategori) {
      items = items.filter((j) => j.kategori === kategori);
    }

    const { page, limit } = parsePagination(req);
    res.json(paginate(items, page, limit));
  },

  async get(req: Request, res: Response) {
    const item = await store.findById(String(req.params.id));
    if (!item) throw new ApiError(404, "Jasa tidak ditemukan");
    res.json(item);
  },

  async create(req: Request, res: Response) {
    const { kode, nama, kategori, jenis, model, deskripsi, harga, komisi, tampilBooking, aktif } = req.body;
    if (!kode || !nama || !kategori || !jenis) {
      throw new ApiError(400, "kode, nama, kategori, dan jenis wajib diisi");
    }
    const item = await store.create({
      kode,
      nama,
      kategori,
      jenis,
      model,
      deskripsi,
      harga: Number(harga) || 0,
      komisi: komisi === undefined || komisi === "" ? 10 : Number(komisi),
      tampilBooking: Boolean(tampilBooking),
      aktif: aktif === undefined ? true : Boolean(aktif),
      createdAt: new Date().toISOString(),
    });
    res.status(201).json(item);
  },

  async update(req: Request, res: Response) {
    const item = await store.update(String(req.params.id), req.body);
    if (!item) throw new ApiError(404, "Jasa tidak ditemukan");
    res.json(item);
  },

  async remove(req: Request, res: Response) {
    const deleted = await store.delete(String(req.params.id));
    if (!deleted) throw new ApiError(404, "Jasa tidak ditemukan");
    res.status(204).send();
  },

  template(_req: Request, res: Response) {
    const buffer = buildTemplateWorkbook("Services", TEMPLATE_HEADERS, TEMPLATE_INSTRUCTIONS);
    sendXlsx(res, buffer, "template-jasa.xlsx");
  },

  async exportXlsx(_req: Request, res: Response) {
    const all = await store.findAll();
    const rows = all.map((j) => [
      j.kode,
      j.nama,
      j.kategori,
      j.jenis,
      j.model ?? "",
      j.harga,
      j.komisi,
      j.deskripsi ?? "",
      j.tampilBooking ? "Ya" : "Tidak",
      j.aktif ? "Ya" : "Tidak",
    ]);
    const buffer = buildExportWorkbook("Services", TEMPLATE_HEADERS, rows);
    sendXlsx(res, buffer, "data-jasa.xlsx");
  },

  async importXlsx(req: Request, res: Response) {
    if (!req.file) throw new ApiError(400, "File tidak ditemukan");
    const rows = parseSheetRows(req.file.buffer, "Services");
    res.json(await importJasaRows(rows));
  },
};

/** Row-processing logic for the "Services" sheet, shared with the combined Barang+Jasa import. */
export async function importJasaRows(rows: Record<string, string>[]): Promise<ImportSummary> {
  const jasaByKode = new Map((await store.findAll()).map((j) => [j.kode.toLowerCase(), j]));
  const summary: ImportSummary = { created: 0, updated: 0, failed: 0, errors: [] };

  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 3;
    try {
      const kode = row["Kode"];
      const nama = row["Nama"];
      const kategori = row["Kategori"];
      const jenis = row["Jenis"];

      if (!kode || !nama || !kategori || !jenis) {
        throw new Error("Kode, Nama, Kategori, dan Jenis wajib diisi");
      }
      const existing = jasaByKode.get(kode.toLowerCase());

      const kategoriNama = await ensureLookup("kategori", kategori);
      const jenisNama = await ensureLookup("jenis", jenis);
      const modelNama = row["Model"] ? await ensureLookup("model", row["Model"]) : undefined;

      const jasaData = {
        kode,
        nama,
        kategori: kategoriNama,
        jenis: jenisNama,
        model: modelNama,
        deskripsi: row["Deskripsi"] || undefined,
        harga: Number(row["Harga Jual"]) || 0,
        komisi: row["Komisi (%)"] ? Number(row["Komisi (%)"]) : 10,
        tampilBooking: (row["Tampil di Booking (Ya/Tidak)"] || "").toLowerCase() === "ya",
        aktif: (row["Aktif (Ya/Tidak)"] || "").toLowerCase() !== "tidak",
      };

      if (existing) {
        const updated = (await store.update(existing.id, jasaData))!;
        jasaByKode.set(kode.toLowerCase(), updated);
        summary.updated = (summary.updated ?? 0) + 1;
      } else {
        const created = await store.create({ ...jasaData, createdAt: new Date().toISOString() });
        jasaByKode.set(kode.toLowerCase(), created);
        summary.created += 1;
      }
    } catch (err) {
      summary.failed += 1;
      summary.errors.push({ row: rowNumber, message: err instanceof Error ? err.message : "Baris tidak valid" });
    }
  }

  return summary;
}
