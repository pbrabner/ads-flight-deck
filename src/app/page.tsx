import { redirect } from "next/navigation";
import { supabaseConfig } from "@/lib/env";
import { requireSession } from "@/lib/auth";
export const dynamic = "force-dynamic";

export default async function Home() {
  if (!supabaseConfig()) redirect("/demo");
  const { db, profile } = await requireSession();
  if (profile.role === "admin") redirect("/admin");
  const { data, error } = await db.from("clients").select("slug").eq("id", profile.client_id!).single();
  if (error || !data) redirect("/login?error=no_profile");
  redirect(`/c/${data.slug}`);
}
