// Site-wide synthesis dashboard. Lists open synthesis findings grouped by
// kind, scored desc. The companion surface to the per-page "Site-wide
// context" callout — this is the portfolio-review view, that one is the
// in-context-of-this-page view.

import { SynthesisDashboard } from "./components/synthesis-dashboard";

export default function SeoSitePage() {
  return (
    <div className="space-y-4 min-w-0">
      <div>
        <h2 className="text-foreground text-lg font-semibold tracking-tight">
          Site-wide opportunities
        </h2>
        <p className="text-muted-foreground mt-1 max-w-3xl text-sm">
          Cross-page strategic findings the per-cluster classifier cannot make on its
          own. These run as the synthesis phase of the SEO sync. Each kind answers a
          different strategic question about the URL graph.
        </p>
      </div>
      <SynthesisDashboard />
    </div>
  );
}
