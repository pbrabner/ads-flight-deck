"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prepareCampaignChange, confirmCampaignChange, cancelCampaignChange, verifyCampaignChange } from "@/lib/campaign-management";
import { changeError } from "@/lib/campaign-workflow";

async function run(form: FormData, action: "preview" | "confirm" | "cancel" | "verify") {
  await requireAdmin();
  const entity = z.uuid().safeParse(form.get("entity_id"));
  if (!entity.success) redirect("/admin?error=invalid");
  const path = `/admin/campaigns/${entity.data}`;
  let error = "", proposal = "";
  try {
    if (action === "preview") proposal = await prepareCampaignChange(entity.data, String(form.get("kind")), String(form.get("value")));
    else {
      proposal = String(form.get("proposal_id"));
      if (action === "confirm") {
        if (form.get("confirmed") !== "yes") throw new Error("proposal_invalid");
        await confirmCampaignChange(entity.data, proposal);
      } else if (action === "cancel") await cancelCampaignChange(entity.data, proposal);
      else await verifyCampaignChange(entity.data, proposal);
    }
  } catch (cause) { error = changeError(cause); }
  revalidatePath(path);
  revalidatePath("/c", "layout");
  const query = new URLSearchParams();
  if (z.uuid().safeParse(proposal).success) query.set("proposal", proposal);
  if (error) query.set("error", error);
  redirect(`${path}?${query}`);
}
export async function previewChange(form: FormData) { await run(form, "preview"); }
export async function confirmChange(form: FormData) { await run(form, "confirm"); }
export async function cancelChange(form: FormData) { await run(form, "cancel"); }
export async function verifyChange(form: FormData) { await run(form, "verify"); }
