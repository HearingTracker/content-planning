// refreshNow server action runs the full GSC + DataForSEO + Storyblok + LLM
// sync. With Phase 1B added, full prod runs (~115 clusters, label + coverage
// LLM passes) can take 6–10 minutes. 800s is the Vercel Pro Fluid Compute max.
// Read/mutate actions for status/assign/notes finish in milliseconds.
export const maxDuration = 800;

export default function SeoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
