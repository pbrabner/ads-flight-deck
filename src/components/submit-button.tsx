"use client";
import { useFormStatus } from "react-dom";
import { LoaderCircle } from "lucide-react";
import { Button } from "./ui/button";
export function SubmitButton({ children, pendingText = "Salvando…", disabled = false }: { children: React.ReactNode; pendingText?: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending || disabled} className="h-10">{pending ? <><LoaderCircle size={15} className="animate-spin" />{pendingText}</> : children}</Button>;
}
