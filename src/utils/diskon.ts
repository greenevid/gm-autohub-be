export type DiskonTipe = "persen" | "rupiah";

export function hitungTotalSetelahDiskon(
  subtotalKotor: number,
  diskonTipe: DiskonTipe | undefined,
  diskonPersen: number,
  diskonRp: number
): number {
  if (diskonTipe === "rupiah") {
    return Math.max(subtotalKotor - diskonRp, 0);
  }
  return subtotalKotor * (1 - diskonPersen / 100);
}
