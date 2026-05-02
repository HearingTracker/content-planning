// Frontend-side mirror of cp_seo_opportunity_kinds. The DB row is the source
// of truth for "which kinds exist" + "what's the author-facing copy", but
// the FE needs concrete Tailwind class strings + lucide icon components,
// which can't live in DB rows. Keep this map in sync with the migration's
// seed when kinds change.

import {
  Bot,
  Calendar,
  CheckCircle2,
  Compass,
  CornerUpRight,
  Crown,
  ExternalLink,
  Link as LinkIcon,
  Loader,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Tags,
  Trash2,
  Trophy,
  Type,
  type LucideIcon,
} from "lucide-react";
import type { SeoOppKindKey, SeoSynthesisKindKey } from "../types";

type Tone = "amber" | "blue" | "emerald" | "rose" | "slate";

type ToneClasses = {
  /** Solid color for stripes / dots */
  stripe: string;
  /** Soft background tint for hover gradients */
  glow: string;
  /** Pill background + text for chips */
  chip: string;
  /** Icon-square background + foreground */
  iconWrap: string;
};

const TONE_CLASSES: Record<Tone, ToneClasses> = {
  amber: {
    stripe: "bg-amber-500",
    glow: "from-amber-100/70 via-amber-50/40",
    chip: "bg-amber-100 text-amber-900 ring-1 ring-inset ring-amber-200",
    iconWrap: "bg-amber-100 text-amber-700",
  },
  blue: {
    stripe: "bg-blue-500",
    glow: "from-blue-100/70 via-blue-50/40",
    chip: "bg-blue-100 text-blue-900 ring-1 ring-inset ring-blue-200",
    iconWrap: "bg-blue-100 text-blue-700",
  },
  emerald: {
    stripe: "bg-emerald-500",
    glow: "from-emerald-100/70 via-emerald-50/40",
    chip: "bg-emerald-100 text-emerald-900 ring-1 ring-inset ring-emerald-200",
    iconWrap: "bg-emerald-100 text-emerald-700",
  },
  rose: {
    stripe: "bg-rose-500",
    glow: "from-rose-100/70 via-rose-50/40",
    chip: "bg-rose-100 text-rose-900 ring-1 ring-inset ring-rose-200",
    iconWrap: "bg-rose-100 text-rose-700",
  },
  slate: {
    stripe: "bg-slate-400",
    glow: "from-slate-100/70 via-slate-50/40",
    chip: "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200",
    iconWrap: "bg-slate-100 text-slate-600",
  },
};

export type KindMeta = {
  key: SeoOppKindKey;
  displayLabel: string;
  shortLabel: string;
  actionVerb: string;
  description: string;
  Icon: LucideIcon;
  tone: ToneClasses;
};

export const KIND_META: Record<SeoOppKindKey, KindMeta> = {
  needs_review: {
    key: "needs_review",
    displayLabel: "Needs review",
    shortLabel: "Review",
    actionVerb: "review",
    description: "Grouped queries. Guidance pending — re-run the sync to classify.",
    Icon: Loader,
    tone: TONE_CLASSES.slate,
  },
  intent_gap: {
    key: "intent_gap",
    displayLabel: "Add a new section",
    shortLabel: "Section",
    actionVerb: "add a section",
    description: "Reader intent isn't answered on this page.",
    Icon: Plus,
    tone: TONE_CLASSES.amber,
  },
  coverage_partial: {
    key: "coverage_partial",
    displayLabel: "Extend this page",
    shortLabel: "Extend",
    actionVerb: "extend the page",
    description: "Page touches the topic but doesn't fully answer it.",
    Icon: Type,
    tone: TONE_CLASSES.blue,
  },
  coverage_strong: {
    key: "coverage_strong",
    displayLabel: "Already covered",
    shortLabel: "Covered",
    actionVerb: "no edit needed",
    description: "Page already answers this — just monitor.",
    Icon: CheckCircle2,
    tone: TONE_CLASSES.emerald,
  },
  snippet_ctr: {
    key: "snippet_ctr",
    displayLabel: "Improve search appeal",
    shortLabel: "Snippet",
    actionVerb: "improve title and meta",
    description: "Ranking is fine but click-through is weak.",
    Icon: Sparkles,
    tone: TONE_CLASSES.blue,
  },
  wrong_page: {
    key: "wrong_page",
    displayLabel: "Write elsewhere",
    shortLabel: "Elsewhere",
    actionVerb: "send to another page",
    description: "This belongs on a different page — don't add it here.",
    Icon: ExternalLink,
    tone: TONE_CLASSES.rose,
  },
  freshness: {
    key: "freshness",
    displayLabel: "Refresh this page",
    shortLabel: "Refresh",
    actionVerb: "refresh facts",
    description: "Pricing or model details may be outdated.",
    Icon: RefreshCw,
    tone: TONE_CLASSES.amber,
  },
  consolidate: {
    key: "consolidate",
    displayLabel: "Claim this topic",
    shortLabel: "Claim",
    actionVerb: "win the topic on this page",
    description: "Multiple pages compete for these queries — this page should win.",
    Icon: Trophy,
    tone: TONE_CLASSES.amber,
  },
  cede: {
    key: "cede",
    displayLabel: "Cede to another page",
    shortLabel: "Cede",
    actionVerb: "handle on another page",
    description: "A sibling page is the stronger target — don't optimize this one.",
    Icon: CornerUpRight,
    tone: TONE_CLASSES.slate,
  },
  ai_overview_loss: {
    key: "ai_overview_loss",
    displayLabel: "AI Overview is taking the click",
    shortLabel: "AIO",
    actionVerb: "rewrite for AI Overview",
    description: "Page ranks but the AI Overview is winning the click — passage-level rewrite needed.",
    Icon: Bot,
    tone: TONE_CLASSES.amber,
  },
};

/** Defensive lookup for unknown kind keys (defensive against DB drift). */
export function getKindMeta(key: string | null | undefined): KindMeta {
  if (key && key in KIND_META) return KIND_META[key as SeoOppKindKey];
  return KIND_META.needs_review;
}

// ─── Phase 1C: site-wide synthesis kinds ───────────────────────────────────
// Parallel taxonomy to KIND_META, keyed by SeoSynthesisKindKey. Mirrors
// cp_seo_synthesis_kinds rows. Used by the per-page "Site-wide context"
// callout and the /seo/site portfolio dashboard.

export type SynthesisKindMeta = {
  key: SeoSynthesisKindKey;
  displayLabel: string;
  shortLabel: string;
  description: string;
  Icon: LucideIcon;
  tone: ToneClasses;
};

export const SYNTHESIS_KIND_META: Record<SeoSynthesisKindKey, SynthesisKindMeta> = {
  fully_ceded_page: {
    key: "fully_ceded_page",
    displayLabel: "Page may be redundant",
    shortLabel: "Redundant",
    description: "Most anchors on this page are already won by a different HearingTracker URL.",
    Icon: Trash2,
    tone: TONE_CLASSES.rose,
  },
  undesignated_topic: {
    key: "undesignated_topic",
    displayLabel: "Pick a winner",
    shortLabel: "Designate",
    description: "Multiple HearingTracker pages compete just outside top 10 — none owns the SERP yet.",
    Icon: Crown,
    tone: TONE_CLASSES.amber,
  },
  orphan_target: {
    key: "orphan_target",
    displayLabel: "No HT page ranks",
    shortLabel: "Orphan",
    description: "Topically adjacent query with high search volume where no HearingTracker URL ranks in top 30.",
    Icon: Compass,
    tone: TONE_CLASSES.amber,
  },
  aio_no_citation: {
    key: "aio_no_citation",
    displayLabel: "AIO with no HT citation",
    shortLabel: "AIO Gap",
    description: "AI Overview shows for this query but no HearingTracker URL is cited as a source.",
    Icon: Bot,
    tone: TONE_CLASSES.blue,
  },
  // ─── Phase 1D blind-spot kinds ──────────────────────────────────────────
  authority_capped_serp: {
    key: "authority_capped_serp",
    displayLabel: "Authority-capped SERP",
    shortLabel: "Authority",
    description: "Top 5 dominated by .gov/.edu/Mayo/NIH — the rank ceiling here is link authority, not on-page anything.",
    Icon: ShieldCheck,
    tone: TONE_CLASSES.slate,
  },
  brand_cannibalization: {
    key: "brand_cannibalization",
    displayLabel: "Brand cannibalization",
    shortLabel: "Brand",
    description: "Multiple HearingTracker pages compete on a branded query — the brand-specific page should win.",
    Icon: Tags,
    tone: TONE_CLASSES.rose,
  },
  freshness: {
    key: "freshness",
    displayLabel: "Stale content",
    shortLabel: "Stale",
    description: "Outdated year-stamp in title, content untouched in over a year, or rank declining.",
    Icon: Calendar,
    tone: TONE_CLASSES.amber,
  },
  internal_link_gap: {
    key: "internal_link_gap",
    displayLabel: "No inbound HT links",
    shortLabel: "Linkless",
    description: "Page ranks top-3 for a high-volume query but no other HearingTracker page links to it.",
    Icon: LinkIcon,
    tone: TONE_CLASSES.blue,
  },
};

export function getSynthesisKindMeta(key: string | null | undefined): SynthesisKindMeta | null {
  if (key && key in SYNTHESIS_KIND_META) return SYNTHESIS_KIND_META[key as SeoSynthesisKindKey];
  return null;
}
