import { cn } from "@/lib/utils";

// Color-code keyword difficulty: green ≤20, amber ≤50, red >50, neutral if unknown.
export function KdPill({ kd }: { kd: number | null }) {
  let label = "—";
  let className = "bg-zinc-100 text-zinc-600";
  if (kd != null) {
    label = String(kd);
    if (kd <= 20) className = "bg-emerald-100 text-emerald-800";
    else if (kd <= 50) className = "bg-amber-100 text-amber-800";
    else className = "bg-rose-100 text-rose-800";
  }
  return (
    <span
      className={cn("inline-flex h-5 min-w-[28px] items-center justify-center rounded-full px-2 text-xs font-medium", className)}
      title="Ahrefs keyword difficulty (0–100)"
    >
      {label}
    </span>
  );
}
