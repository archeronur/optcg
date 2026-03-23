/** OP-05 and earlier: deck lists omitted; show standings only. */
export function isLegacyMetaThroughOp05(metaId: string): boolean {
  const m = metaId.trim().toLowerCase().match(/^op(\d+)$/);
  if (!m) return false;
  const n = parseInt(m[1], 10);
  return n >= 1 && n <= 5;
}
