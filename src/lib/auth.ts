import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { serverDb } from "./supabase/server";
import { supabaseConfig } from "./env";

export const requireSession = cache(async () => {
  if (!supabaseConfig()) redirect("/login?error=setup");
  const db = await serverDb();
  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user) redirect("/login");
  const { data: profile, error: profileError } = await db.from("profiles").select("user_id,role,client_id,email").eq("user_id", user.id).maybeSingle();
  if (profileError) throw new Error("Não foi possível consultar suas permissões.");
  if (!profile) redirect("/login?error=no_profile");
  return { db, user, profile: profile as { user_id: string; role: "admin" | "client"; client_id: string | null; email: string } };
});
export async function requireAdmin() {
  const session = await requireSession();
  if (session.profile.role !== "admin") redirect("/");
  return session;
}
