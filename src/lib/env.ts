export function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? { url, key } : null;
}
export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Configuração ausente: ${name}`);
  return value;
}
export function appUrl(): string {
  const value = new URL(requiredEnv("NEXT_PUBLIC_APP_URL"));
  if (value.protocol !== "https:" && !(value.protocol === "http:" && ["localhost", "127.0.0.1"].includes(value.hostname))) throw new Error("A URL pública deve usar HTTPS.");
  return value.origin;
}
