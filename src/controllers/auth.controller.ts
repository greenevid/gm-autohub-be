import { randomUUID } from "crypto";
import { Request, Response } from "express";
import { ApiError } from "../middlewares/errorHandler";
import { verifyPassword } from "../utils/password";
import { userStore } from "./user.controller";
import { PublicUser, User } from "../models/types";

interface Session {
  userId: string;
  expiresAt: number;
}

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const sessionStore = new Map<string, Session>();

export function resolveSession(token: string | undefined) {
  if (!token) return undefined;
  const session = sessionStore.get(token);
  if (!session) return undefined;
  if (session.expiresAt < Date.now()) {
    sessionStore.delete(token);
    return undefined;
  }
  return session;
}

function toPublicUser(user: User): PublicUser {
  const { passwordHash: _passwordHash, ...rest } = user;
  return rest;
}

export const authController = {
  login(req: Request, res: Response) {
    const { email, password } = req.body;
    if (!email || !password) throw new ApiError(400, "email dan password wajib diisi");

    const user = userStore.findAll().find((u) => u.email.toLowerCase() === String(email).toLowerCase());
    if (!user || !verifyPassword(password, user.passwordHash)) {
      throw new ApiError(401, "Email atau password salah");
    }
    if (!user.aktif) throw new ApiError(403, "Akun tidak aktif");

    const token = randomUUID();
    sessionStore.set(token, { userId: user.id, expiresAt: Date.now() + SESSION_TTL_MS });
    res.json({ token, user: toPublicUser(user) });
  },

  logout(req: Request, res: Response) {
    const auth = req.headers.authorization;
    const token = auth?.startsWith("Bearer ") ? auth.slice(7) : undefined;
    if (token) sessionStore.delete(token);
    res.status(204).send();
  },

  me(req: Request, res: Response) {
    const auth = req.headers.authorization;
    const token = auth?.startsWith("Bearer ") ? auth.slice(7) : undefined;
    const session = resolveSession(token);
    if (!session) throw new ApiError(401, "Belum login");
    const user = userStore.findById(session.userId);
    if (!user) throw new ApiError(401, "Belum login");
    res.json(toPublicUser(user));
  },
};
