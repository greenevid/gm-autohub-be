import { lookupStore } from "../controllers/pengaturan.controller";
import { LookupTipe } from "../models/types";

export function ensureLookup(tipe: LookupTipe, nama: string): string {
  const trimmed = nama.trim();
  const existing = lookupStore.findAll().find((l) => l.tipe === tipe && l.nama.toLowerCase() === trimmed.toLowerCase());
  if (existing) return existing.nama;
  lookupStore.create({ tipe, nama: trimmed, createdAt: new Date().toISOString() });
  return trimmed;
}
