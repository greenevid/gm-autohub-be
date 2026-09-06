export function generateKode(prefix: string, existingCodes: string[]): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yy = String(now.getFullYear()).slice(-2);
  const datePart = `${dd}${mm}${yy}`;
  const todayPrefix = `${prefix}-${datePart}-`;

  const countToday = existingCodes.filter((kode) => kode.startsWith(todayPrefix)).length;
  const sequence = String(countToday + 1).padStart(5, "0");

  return `${todayPrefix}${sequence}`;
}
