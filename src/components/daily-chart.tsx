"use client";
import { useId } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "./ui/chart";
import { count, money, shortDate } from "@/lib/format";
import type { DailyMetrics } from "@/lib/metrics";

export function DailyChart({ data, metric, resultName = "Resultados" }: { data: (DailyMetrics & { result?: number | null })[]; metric: "spend" | "result"; resultName?: string }) {
  const fillId = `fill-${useId().replace(/:/g, "")}`;
  const label = metric === "spend" ? "Investimento" : resultName;
  const color = metric === "spend" ? "#275cce" : "#167b67";
  return <ChartContainer className="daily-chart h-[240px] w-full" config={{ [metric]: { label, color } }} aria-label={`${label} por dia`}>
    <AreaChart accessibilityLayer data={data} margin={{ top: 8, right: 14, bottom: 6, left: 0 }}>
      <defs><linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={0.2} /><stop offset="100%" stopColor={color} stopOpacity={0.01} /></linearGradient></defs>
      <CartesianGrid vertical={false} strokeDasharray="3 4" />
      <XAxis dataKey="date" tickFormatter={shortDate} tickLine={false} axisLine={false} minTickGap={40} tickMargin={12} />
      <YAxis tickLine={false} axisLine={false} width={60} tickFormatter={v => metric === "spend" ? `R$ ${count(v)}` : count(v)} />
      <ChartTooltip content={<ChartTooltipContent labelFormatter={v => shortDate(String(v))} formatter={value => <span className="font-medium">{label}: {metric === "spend" ? money(Number(value)) : count(Number(value))}</span>} />} />
      <Area dataKey={metric} type="monotone" stroke={color} strokeWidth={2.5} fill={`url(#${fillId})`} isAnimationActive={false} />
    </AreaChart>
  </ChartContainer>;
}
