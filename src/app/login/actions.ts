"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { serverDb } from "@/lib/supabase/server";
import { supabaseConfig } from "@/lib/env";

export async function login(form: FormData) {
  if (!supabaseConfig()) redirect("/login?error=setup");
  const parsed = z.object({ email: z.email(), password: z.string().min(1).max(1024) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) redirect("/login?error=invalid");
  const db = await serverDb();
  const { error } = await db.auth.signInWithPassword(parsed.data);
  if (error) redirect("/login?error=invalid");
  redirect("/");
}
export async function logout() {
  if (supabaseConfig()) {
    const db = await serverDb();
    await db.auth.signOut();
  }
  redirect("/login");
}
