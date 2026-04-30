import { Badge } from "@/components/ui/badge";
import type { SeoOppKind } from "../types";

const styles: Record<SeoOppKind, { className: string; label: string; hint: string }> = {
  primary: {
    className: "bg-zinc-100 text-zinc-700 hover:bg-zinc-100",
    label: "Primary",
    hint: "Already in title/H1",
  },
  supporting: {
    className: "bg-blue-100 text-blue-800 hover:bg-blue-100",
    label: "Supporting",
    hint: "Mentioned in body — promote to H2",
  },
  secondary: {
    className: "bg-orange-100 text-orange-800 hover:bg-orange-100",
    label: "Secondary",
    hint: "Missing from page — add a section",
  },
};

export function KindBadge({ kind }: { kind: SeoOppKind }) {
  const s = styles[kind];
  return (
    <Badge variant="secondary" className={s.className} title={s.hint}>
      {s.label}
    </Badge>
  );
}
