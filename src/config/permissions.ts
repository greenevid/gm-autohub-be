import { UserRole } from "../models/types";

export const MODULE_KEYS = [
  "barang-jasa",
  "penjualan",
  "pembelian",
  "manajemen-stok",
  "pelanggan",
  "supplier",
  "manajemen-karyawan",
  "pengaturan",
  "manajemen-user",
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];

/**
 * Single source of truth for which roles can access which module.
 * Mirrored on the frontend at src/lib/permissions.ts — keep both in sync.
 */
export const MODULE_ROLES: Record<ModuleKey, UserRole[]> = {
  "barang-jasa": ["superadmin", "admin", "staff"],
  penjualan: ["superadmin", "admin", "staff"],
  pembelian: ["superadmin", "admin", "staff"],
  "manajemen-stok": ["superadmin", "admin", "staff"],
  pelanggan: ["superadmin", "admin", "staff"],
  supplier: ["superadmin", "admin", "staff"],
  "manajemen-karyawan": ["superadmin", "admin"],
  pengaturan: ["superadmin", "admin"],
  "manajemen-user": ["superadmin"],
};
