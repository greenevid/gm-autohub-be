import { lookupStore } from "../controllers/pengaturan.controller";
import { LookupTipe } from "../models/types";

export async function ensureLookup(tipe: LookupTipe, nama: string): Promise<string> {
  const trimmed = nama.trim();
  const all = await lookupStore.findAll();
  const existing = all.find((l) => l.tipe === tipe && l.nama.toLowerCase() === trimmed.toLowerCase());
  if (existing) return existing.nama;
  await lookupStore.create({ tipe, nama: trimmed, createdAt: new Date().toISOString() });
  return trimmed;
}
