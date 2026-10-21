export type SearchParams = Record<string, string | string[] | undefined>;
export type Period = { range: string; from: string; to: string; prevFrom: string; prevTo: string };
const DAY = 86_400_000;
export const dateStamp = (date: Date) => date.toISOString().slice(0, 10);
export const addDays = (date: string, days: number) => dateStamp(new Date(Date.parse(`${date}T12:00:00Z`) + days * DAY));
export function isDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && dateStamp(new Date(value)) === value;
}
export function todayIn(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
export function periodFromParams(params: SearchParams, now = new Date()): Period {
  const today = todayIn(now);
  let range = typeof params.range === "string" ? params.range : "7d";
  let from = addDays(today, -6), to = today;
  const monthStart = `${today.slice(0, 7)}-01`;
  if (range === "today") from = today;
  else if (range === "30d") from = addDays(today, -29);
  else if (range === "month") from = monthStart;
  else if (range === "last_month") {
    to = addDays(monthStart, -1);
    from = `${to.slice(0, 7)}-01`;
  } else if (range === "custom" && isDate(params.from) && isDate(params.to) && params.from <= params.to
    && Date.parse(params.to) - Date.parse(params.from) <= 366 * DAY) {
    from = params.from; to = params.to;
  } else range = "7d";
  const length = Math.round((Date.parse(to) - Date.parse(from)) / DAY) + 1;
  let prevTo = addDays(from, -1), prevFrom = addDays(from, -length);
  if (range === "month") {
    prevFrom = `${prevTo.slice(0, 7)}-01`;
    prevTo = addDays(prevFrom, Math.min(Number(today.slice(-2)), Number(prevTo.slice(-2))) - 1);
  }
  return { range, from, to, prevFrom, prevTo };
}
export function chunkRange(from: string, to: string, size = 30): { from: string; to: string }[] {
  if (!isDate(from) || !isDate(to) || from > to || !Number.isInteger(size) || size < 1) throw new Error("Período inválido.");
  const result = [];
  for (let start = from; start <= to;) {
    const end = addDays(start, size - 1);
    result.push({ from: start, to: end < to ? end : to });
    start = addDays(end, 1);
  }
  return result;
}
export function periodQuery(period: Period): string {
  return new URLSearchParams({ range: period.range, from: period.from, to: period.to }).toString();
}
