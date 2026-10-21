import { timingSafeEqual } from "node:crypto";
export function validSecret(actual: string, expected: string): boolean {
  if (!actual || !expected) return false;
  const a = Buffer.from(actual), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
