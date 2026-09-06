import { Request, Response } from "express";
import { SqliteStore } from "../utils/sqliteStore";
import { PembayaranHutang } from "../models/types";
import { ApiError } from "../middlewares/errorHandler";
import { computeStatusPembayaran, pembelianNetTotal, pembelianStore } from "./pembelian.controller";

const store = new SqliteStore<PembayaranHutang>("pembayaran_hutang");

export const pembayaranHutangController = {
  list(_req: Request, res: Response) {
    res.json(store.findAll());
  },

  create(req: Request, res: Response) {
    const { pembelianId, tanggal, jumlah, metode } = req.body;
    if (!pembelianId || !jumlah) throw new ApiError(400, "pembelianId dan jumlah wajib diisi");

    const pembelian = pembelianStore.findById(pembelianId);
    if (!pembelian) throw new ApiError(400, `Pembelian dengan id ${pembelianId} tidak ditemukan`);

    const item = store.create({
      pembelianId,
      tanggal: tanggal || new Date().toISOString(),
      jumlah: Number(jumlah),
      metode,
      createdAt: new Date().toISOString(),
    });

    const dibayarBaru = pembelian.dibayar + Number(jumlah);
    pembelianStore.update(pembelian.id, {
      dibayar: dibayarBaru,
      statusPembayaran: computeStatusPembayaran(pembelianNetTotal(pembelian), dibayarBaru),
    });

    res.status(201).json(item);
  },

  remove(req: Request, res: Response) {
    const deleted = store.delete(String(req.params.id));
    if (!deleted) throw new ApiError(404, "Pembayaran hutang tidak ditemukan");
    res.status(204).send();
  },
};
