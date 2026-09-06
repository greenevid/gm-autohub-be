// Imports real data exported from "Sentral Part" (GMI) into the running API.
// - imports/items-gmi.xlsx      -> sheet "Items"    -> Barang
// - imports/services-gmi.xlsx   -> sheet "Services" -> Jasa
// Any Kategori/Jenis/Model/Brand/Grup/Supplier referenced by a row is created
// automatically in Pengaturan (lookup) / Supplier if it doesn't exist yet.
//
// Usage: node scripts/import-gmi.mjs   (run while `npm run dev` is already up)
import XLSX from "xlsx";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_URL = process.env.API_URL ?? "http://localhost:4000/api";
const SUPERADMIN_EMAIL = process.env.SEED_EMAIL ?? "superadmin@bengkelku.com";
const SUPERADMIN_PASSWORD = process.env.SEED_PASSWORD ?? "SuperAdmin123!";

let authToken = null;

async function login() {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: SUPERADMIN_EMAIL, password: SUPERADMIN_PASSWORD }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Login gagal -> ${res.status} ${text}`);
  }
  const data = await res.json();
  authToken = data.token;
}

async function api(method, url, body) {
  const res = await fetch(`${API_URL}${url}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${method} ${url} -> ${res.status} ${text}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

function readSheet(file, sheetName) {
  const wb = XLSX.readFile(path.join(__dirname, "..", "imports", file));
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: "" });
  // First row is always the instructions/example row, not real data.
  return rows.slice(1).filter((r) => String(r["Kode"]).trim());
}

const str = (v) => String(v ?? "").trim();
const num = (v) => (v === "" || v === undefined || v === null ? undefined : Number(v));

// --- Lookup cache: tipe -> Map(namaLower -> id) -----------------------------
const lookupCache = new Map();

async function ensureLookup(tipe, nama) {
  const name = str(nama);
  if (!name) return undefined;
  if (!lookupCache.has(tipe)) {
    const existing = await api("GET", `/pengaturan/lookup?tipe=${tipe}`);
    lookupCache.set(tipe, new Map(existing.map((l) => [l.nama.toLowerCase(), l.id])));
  }
  const cache = lookupCache.get(tipe);
  const key = name.toLowerCase();
  if (cache.has(key)) return cache.get(key);
  const created = await api("POST", "/pengaturan/lookup", { tipe, nama: name });
  cache.set(key, created.id);
  return created.id;
}

// --- Supplier cache: namaLower -> id ----------------------------------------
let supplierCache = null;

async function ensureSupplier(nama) {
  const name = str(nama);
  if (!name) return undefined;
  if (!supplierCache) {
    const existing = await api("GET", "/supplier");
    supplierCache = new Map(existing.map((s) => [s.nama.toLowerCase(), s.id]));
  }
  const key = name.toLowerCase();
  if (supplierCache.has(key)) return supplierCache.get(key);
  const created = await api("POST", "/supplier", {
    nama: name,
    tipe: "Umum",
    telepon: "-",
    email: "-",
    kota: "-",
    alamat: "-",
  });
  supplierCache.set(key, created.id);
  return created.id;
}

async function importItems() {
  const rows = readSheet("items-gmi.xlsx", "Items");
  console.log(`Importing ${rows.length} barang from Items sheet...`);

  let created = 0;
  for (const row of rows) {
    await ensureLookup("kategori", row["Kategori"]);
    await ensureLookup("jenis", row["Jenis"]);
    await ensureLookup("model", row["Model"]);
    await ensureLookup("brand", row["Brand"]);
    await ensureLookup("grup", row["Group"]);
    const supplierId = await ensureSupplier(row["Supplier"]);

    const satuan = str(row["Unit"]).toUpperCase() || "PCS";
    const hargaBeli = num(row[" Harga Beli "]) ?? 0;
    const hargaJual = num(row["Harga Jual"]) ?? 0;
    const komisi = num(row["Komisi (%)"]);
    const minStock = num(row["Minimal Stock"]);

    await api("POST", "/barang", {
      kode: str(row["Kode"]),
      nama: str(row["Nama"]),
      kategori: str(row["Kategori"]) || "Umum",
      jenis: str(row["Jenis"]) || undefined,
      grup: str(row["Group"]) || undefined,
      brand: str(row["Brand"]) || undefined,
      model: str(row["Model"]) || undefined,
      supplierId,
      deskripsi: str(row["Deskripsi"]) || undefined,
      tampilBooking: true,
      aktif: str(row["Active"]).toUpperCase() !== "N",
      units: [
        {
          satuan,
          hargaBeli,
          hargaJual,
          conversionFactor: 1,
          komisi,
          isDefault: true,
        },
      ],
      stokLokasi:
        minStock !== undefined
          ? [{ satuan, lokasi: "Gudang Utama", jumlah: 0, stokMinimum: minStock }]
          : [],
    });
    created += 1;
  }
  console.log(`Barang imported: ${created}`);
}

async function importServices() {
  const rows = readSheet("services-gmi.xlsx", "Services");
  console.log(`Importing ${rows.length} jasa from Services sheet...`);

  let created = 0;
  for (const row of rows) {
    await ensureLookup("kategori", row["Kategori"]);
    await ensureLookup("jenis", row["Jenis"]);
    await ensureLookup("model", row["Model"]);

    await api("POST", "/jasa", {
      kode: str(row["Kode"]),
      nama: str(row["Nama"]),
      kategori: str(row["Kategori"]) || "Umum",
      jenis: str(row["Jenis"]) || "Umum",
      model: str(row["Model"]) || undefined,
      deskripsi: str(row["Deskripsi"]) || undefined,
      harga: num(row["Harga Jual"]) ?? 0,
      komisi: num(row["Komisi (%)"]) ?? 10,
      tampilBooking: true,
    });
    created += 1;
  }
  console.log(`Jasa imported: ${created}`);
}

async function main() {
  console.log("Logging in as superadmin...");
  await login();

  await importItems();
  await importServices();
  console.log("\nDone! GMI data imported and cross-linked into Pengaturan.");
}

main().catch((err) => {
  console.error("Import failed:", err.message);
  process.exit(1);
});
