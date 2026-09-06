import { Request, Response } from "express";
import { SqliteStore } from "../utils/sqliteStore";
import { PembayaranHutang } from "../models/types";
import { ApiError } from "../middlewares/errorHandler";
import { computeStatusPembayaran, pembelianNetTotal, pembelianStore } from "./pembelian.controller";

const store = new SqliteStore<PembayaranHutang>("pembayaran_hutang");

export const pembayaranHutangController = {
  async list(_req: Request, res: Response) {
    res.json(await store.findAll());
  },

  async create(req: Request, res: Response) {
    const { pembelianId, tanggal, jumlah, metode } = req.body;
    if (!pembelianId || !jumlah) throw new ApiError(400, "pembelianId dan jumlah wajib diisi");
    const jumlahNum = Number(jumlah);

    const pembelianExists = await pembelianStore.findById(pembelianId);
    if (!pembelianExists) throw new ApiError(400, `Pembelian dengan id ${pembelianId} tidak ditemukan`);

    const item = await store.create({
      pembelianId,
      tanggal: tanggal || new Date().toISOString(),
      jumlah: jumlahNum,
      metode,
      createdAt: new Date().toISOString(),
    });

    // Row-locked so two concurrent payments on the same pembelian can't clobber each other's dibayar update.
    await pembelianStore.updateWithLock(pembelianId, (current) => {
      const dibayarBaru = current.dibayar + jumlahNum;
      return {
        dibayar: dibayarBaru,
        statusPembayaran: computeStatusPembayaran(pembelianNetTotal(current), dibayarBaru),
      };
    });

    res.status(201).json(item);
  },

  async remove(req: Request, res: Response) {
    const deleted = await store.delete(String(req.params.id));
    if (!deleted) throw new ApiError(404, "Pembayaran hutang tidak ditemukan");
    res.status(204).send();
  },
};
