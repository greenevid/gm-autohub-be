import { Request, Response } from "express";
import { SqliteStore } from "../utils/sqliteStore";
import { Pembayaran } from "../models/types";
import { ApiError } from "../middlewares/errorHandler";
import { computeStatusPembayaran, invoiceNetTotal, invoiceStore } from "./invoice.controller";

const store = new SqliteStore<Pembayaran>("pembayaran");

export const pembayaranController = {
  async list(_req: Request, res: Response) {
    res.json(await store.findAll());
  },

  async create(req: Request, res: Response) {
    const { invoiceId, tanggal, jumlah, metode } = req.body;
    if (!invoiceId || !jumlah) throw new ApiError(400, "invoiceId dan jumlah wajib diisi");
    const jumlahNum = Number(jumlah);

    const invoiceExists = await invoiceStore.findById(invoiceId);
    if (!invoiceExists) throw new ApiError(400, `Invoice dengan id ${invoiceId} tidak ditemukan`);

    const item = await store.create({
      invoiceId,
      tanggal: tanggal || new Date().toISOString(),
      jumlah: jumlahNum,
      metode,
      createdAt: new Date().toISOString(),
    });

    // Row-locked so two concurrent payments on the same invoice can't clobber each other's dibayar update.
    await invoiceStore.updateWithLock(invoiceId, (current) => {
      const dibayarBaru = current.dibayar + jumlahNum;
      return {
        dibayar: dibayarBaru,
        statusPembayaran: computeStatusPembayaran(invoiceNetTotal(current), dibayarBaru),
      };
    });

    res.status(201).json(item);
  },

  async remove(req: Request, res: Response) {
    const deleted = await store.delete(String(req.params.id));
    if (!deleted) throw new ApiError(404, "Pembayaran tidak ditemukan");
    res.status(204).send();
  },
};
