export const money = (value: number | null) => value === null ? "—" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
export const count = (value: number | null) => value === null ? "—" : new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value);
export const pct = (value: number | null) => value === null ? "—" : `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value)}%`;
export const shortDate = (value: string) => new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
