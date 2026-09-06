import { Request, Response } from "express";
import { SqliteStore } from "../utils/sqliteStore";
import { Pembayaran } from "../models/types";
import { ApiError } from "../middlewares/errorHandler";
import { computeStatusPembayaran, invoiceNetTotal, invoiceStore } from "./invoice.controller";

const store = new SqliteStore<Pembayaran>("pembayaran");

export const pembayaranController = {
  list(_req: Request, res: Response) {
    res.json(store.findAll());
  },

  create(req: Request, res: Response) {
    const { invoiceId, tanggal, jumlah, metode } = req.body;
    if (!invoiceId || !jumlah) throw new ApiError(400, "invoiceId dan jumlah wajib diisi");

    const invoice = invoiceStore.findById(invoiceId);
    if (!invoice) throw new ApiError(400, `Invoice dengan id ${invoiceId} tidak ditemukan`);

    const item = store.create({
      invoiceId,
      tanggal: tanggal || new Date().toISOString(),
      jumlah: Number(jumlah),
      metode,
      createdAt: new Date().toISOString(),
    });

    const dibayarBaru = invoice.dibayar + Number(jumlah);
    invoiceStore.update(invoice.id, {
      dibayar: dibayarBaru,
      statusPembayaran: computeStatusPembayaran(invoiceNetTotal(invoice), dibayarBaru),
    });

    res.status(201).json(item);
  },

  remove(req: Request, res: Response) {
    const deleted = store.delete(String(req.params.id));
    if (!deleted) throw new ApiError(404, "Pembayaran tidak ditemukan");
    res.status(204).send();
  },
};
