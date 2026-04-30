// refreshNow server action runs the full GSC + Ahrefs + Storyblok + DB sync,
// ~2 minutes. The route segment's maxDuration applies to its server actions, so
// this layout exists solely to carry that config. Read/mutate actions for
// status/assign/notes finish in milliseconds and are unaffected.
export const maxDuration = 300;

export default function SeoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
