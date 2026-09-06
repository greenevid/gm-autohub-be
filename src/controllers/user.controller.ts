import { Request, Response } from "express";
import { SqliteStore } from "../utils/sqliteStore";
import { PublicUser, User, USER_ROLE_OPTIONS, UserRole } from "../models/types";
import { ApiError } from "../middlewares/errorHandler";
import { hashPassword } from "../utils/password";

export const userStore = new SqliteStore<User>("user");

const DEFAULT_SUPERADMIN_EMAIL = "superadmin@bengkelku.com";
const DEFAULT_SUPERADMIN_PASSWORD = "SuperAdmin123!";

function seedDefaultSuperadmin() {
  if (userStore.findAll().some((u) => u.email === DEFAULT_SUPERADMIN_EMAIL)) return;
  userStore.create({
    nama: "Super Admin",
    email: DEFAULT_SUPERADMIN_EMAIL,
    passwordHash: hashPassword(DEFAULT_SUPERADMIN_PASSWORD),
    role: "superadmin",
    aktif: true,
    createdAt: new Date().toISOString(),
  });
  console.log(`Seeded default superadmin: ${DEFAULT_SUPERADMIN_EMAIL} / ${DEFAULT_SUPERADMIN_PASSWORD}`);
}

seedDefaultSuperadmin();

function toPublicUser(user: User): PublicUser {
  const { passwordHash: _passwordHash, ...rest } = user;
  return rest;
}

export const userController = {
  list(_req: Request, res: Response) {
    res.json(userStore.findAll().map(toPublicUser));
  },

  get(req: Request, res: Response) {
    const item = userStore.findById(String(req.params.id));
    if (!item) throw new ApiError(404, "User tidak ditemukan");
    res.json(toPublicUser(item));
  },

  create(req: Request, res: Response) {
    const { nama, email, password, role, aktif } = req.body;
    if (!nama || !email || !password) throw new ApiError(400, "nama, email, dan password wajib diisi");
    if (!USER_ROLE_OPTIONS.includes(role)) throw new ApiError(400, "role tidak valid");
    if (userStore.findAll().some((u) => u.email.toLowerCase() === String(email).toLowerCase())) {
      throw new ApiError(400, "Email sudah digunakan");
    }
    const item = userStore.create({
      nama,
      email,
      passwordHash: hashPassword(password),
      role: role as UserRole,
      aktif: aktif === undefined ? true : Boolean(aktif),
      createdAt: new Date().toISOString(),
    });
    res.status(201).json(toPublicUser(item));
  },

  update(req: Request, res: Response) {
    const { password, role, ...rest } = req.body;
    if (role !== undefined && !USER_ROLE_OPTIONS.includes(role)) {
      throw new ApiError(400, "role tidak valid");
    }
    const patch: Partial<User> = { ...rest };
    if (role !== undefined) patch.role = role as UserRole;
    if (password) patch.passwordHash = hashPassword(password);

    const item = userStore.update(String(req.params.id), patch);
    if (!item) throw new ApiError(404, "User tidak ditemukan");
    res.json(toPublicUser(item));
  },

  remove(req: Request, res: Response) {
    const target = userStore.findById(String(req.params.id));
    if (!target) throw new ApiError(404, "User tidak ditemukan");
    if (target.role === "superadmin" && userStore.findAll().filter((u) => u.role === "superadmin").length <= 1) {
      throw new ApiError(400, "Tidak bisa menghapus satu-satunya akun superadmin");
    }
    userStore.delete(target.id);
    res.status(204).send();
  },
};
