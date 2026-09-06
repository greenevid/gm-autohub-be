import multer from "multer";
import { ApiError } from "./errorHandler";

const ALLOWED_MIME = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
]);

export const uploadXlsx = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (!ALLOWED_MIME.has(file.mimetype) && !file.originalname.toLowerCase().endsWith(".xlsx")) {
      cb(new ApiError(400, "File harus berformat .xlsx"));
      return;
    }
    cb(null, true);
  },
}).single("file");
