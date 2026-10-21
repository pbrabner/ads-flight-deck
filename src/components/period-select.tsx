"use client";
import type { PlatformFilter } from "@/lib/platform";
import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays, LoaderCircle } from "lucide-react";
import type { Period } from "@/lib/period";
import { Button } from "./ui/button";
import type { CampaignStatus } from "@/lib/results";

export function PeriodSelect({ period, status = "all", platform = "all" }: { period: Period; status?: CampaignStatus; platform?: PlatformFilter }) {
  const router = useRouter(), pathname = usePathname();
  const [range, setRange] = useState(period.range);
  const [pending, startTransition] = useTransition();
  function navigate(params: URLSearchParams) { params.set("status", status); params.set("platform", platform); startTransition(() => router.push(`${pathname}?${params}`)); }
  return <form className="period-form" onSubmit={event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    navigate(new URLSearchParams({ range: "custom", from: String(data.get("from")), to: String(data.get("to")) }));
  }}>
    <CalendarDays size={17} aria-hidden />
    <label className="sr-only" htmlFor="period">Período</label>
    <select id="period" name="range" value={range} disabled={pending} onChange={event => {
      setRange(event.target.value);
      if (event.target.value !== "custom") navigate(new URLSearchParams({ range: event.target.value }));
    }}>
      <option value="today">Hoje</option><option value="7d">Últimos 7 dias</option><option value="30d">Últimos 30 dias</option><option value="month">Este mês</option><option value="last_month">Mês passado</option><option value="custom">Personalizado</option>
    </select>
    {range === "custom" && <><label className="sr-only" htmlFor="from">Data inicial</label><input id="from" type="date" name="from" defaultValue={period.from} required /><span>até</span><label className="sr-only" htmlFor="to">Data final</label><input id="to" type="date" name="to" defaultValue={period.to} required /><Button type="submit" disabled={pending}>Aplicar</Button></>}
    {pending && <LoaderCircle className="animate-spin" size={16} aria-label="Carregando período" />}
  </form>;
}
