import { SeoPageDetail } from "./seo-page-detail";

// Catch-all slug preserves multi-segment paths (e.g. /reviews/best-hearing-aids)
// natively, matching the SeoPage.page values stored in the DB. Literal sibling
// routes /seo/admin/* and /seo/site take precedence over this catch-all.
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const page = "/" + (slug ?? []).join("/");
  return <SeoPageDetail page={page} />;
}
