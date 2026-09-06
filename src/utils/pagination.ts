import { Request } from "express";

export interface PagedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export function parsePagination(req: Request, defaultLimit = 10): { page: number; limit: number } {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.max(1, Number(req.query.limit) || defaultLimit);
  return { page, limit };
}

export function paginate<T>(items: T[], page: number, limit: number): PagedResult<T> {
  const total = items.length;
  const start = (page - 1) * limit;
  return { data: items.slice(start, start + limit), total, page, limit };
}
