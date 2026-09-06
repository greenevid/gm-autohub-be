import { Request, Response } from "express";
import { SqliteSetting, SqliteStore } from "../utils/sqliteStore";
import { CompanyProfile, Lookup, LOOKUP_TIPE_OPTIONS, LookupTipe, PajakSetting } from "../models/types";
import { ApiError } from "../middlewares/errorHandler";

export const lookupStore = new SqliteStore<Lookup>("lookup");
const store = lookupStore;

function assertTipe(tipe: unknown): asserts tipe is LookupTipe {
  if (typeof tipe !== "string" || !LOOKUP_TIPE_OPTIONS.includes(tipe as LookupTipe)) {
    throw new ApiError(400, `tipe harus salah satu dari: ${LOOKUP_TIPE_OPTIONS.join(", ")}`);
  }
}

export const lookupController = {
  list(req: Request, res: Response) {
    const { tipe, search } = req.query;
    assertTipe(tipe);
    let items = store.findAll().filter((l) => l.tipe === tipe);
    if (typeof search === "string" && search.trim()) {
      const q = search.trim().toLowerCase();
      items = items.filter((l) => l.nama.toLowerCase().includes(q));
    }
    res.json(items);
  },

  create(req: Request, res: Response) {
    const { tipe, nama, deskripsi, jatuhTempoHari } = req.body;
    assertTipe(tipe);
    if (!nama) throw new ApiError(400, "nama wajib diisi");
    const item = store.create({
      tipe,
      nama,
      deskripsi: deskripsi || undefined,
      jatuhTempoHari: jatuhTempoHari !== undefined && jatuhTempoHari !== "" ? Number(jatuhTempoHari) : undefined,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json(item);
  },

  update(req: Request, res: Response) {
    const { tipe: _tipe, jatuhTempoHari, ...rest } = req.body;
    const patch = {
      ...rest,
      ...(jatuhTempoHari !== undefined
        ? { jatuhTempoHari: jatuhTempoHari === "" ? undefined : Number(jatuhTempoHari) }
        : {}),
    };
    const item = store.update(String(req.params.id), patch);
    if (!item) throw new ApiError(404, "Data tidak ditemukan");
    res.json(item);
  },

  remove(req: Request, res: Response) {
    const deleted = store.delete(String(req.params.id));
    if (!deleted) throw new ApiError(404, "Data tidak ditemukan");
    res.status(204).send();
  },
};

export const pajakSettings = new SqliteSetting<PajakSetting>("pajak", { aktif: true, persentase: 11, pembulatan: 0 });

export const pajakController = {
  get(_req: Request, res: Response) {
    res.json(pajakSettings.get());
  },

  update(req: Request, res: Response) {
    const { aktif, persentase, pembulatan } = req.body;
    const current = pajakSettings.get();
    const updated = pajakSettings.update({
      aktif: aktif !== undefined ? Boolean(aktif) : current.aktif,
      persentase: persentase !== undefined ? Number(persentase) : current.persentase,
      pembulatan: pembulatan !== undefined ? Number(pembulatan) : current.pembulatan,
    });
    res.json(updated);
  },
};

export const companyProfileSettings = new SqliteSetting<CompanyProfile>("company_profile", {
  namaPerusahaan: "Nama Bengkel Anda",
  alamat: "",
  telepon: "",
  email: "",
  bankNama: "",
  bankNoRekening: "",
  bankAtasNama: "",
});

export const companyProfileController = {
  get(_req: Request, res: Response) {
    res.json(companyProfileSettings.get());
  },

  update(req: Request, res: Response) {
    const { namaPerusahaan, alamat, telepon, email, bankNama, bankNoRekening, bankAtasNama } = req.body;
    const current = companyProfileSettings.get();
    const updated = companyProfileSettings.update({
      namaPerusahaan: namaPerusahaan !== undefined ? String(namaPerusahaan) : current.namaPerusahaan,
      alamat: alamat !== undefined ? String(alamat) : current.alamat,
      telepon: telepon !== undefined ? String(telepon) : current.telepon,
      email: email !== undefined ? String(email) : current.email,
      bankNama: bankNama !== undefined ? String(bankNama) : current.bankNama,
      bankNoRekening: bankNoRekening !== undefined ? String(bankNoRekening) : current.bankNoRekening,
      bankAtasNama: bankAtasNama !== undefined ? String(bankAtasNama) : current.bankAtasNama,
    });
    res.json(updated);
  },
};
