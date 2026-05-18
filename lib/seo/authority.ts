// Shared authority-domain classification. Originally lived in
// lib/seo/synthesis.ts for the `authority_capped_serp` detector; promoted to
// its own module so the coverage classifier can also annotate competitor
// SERPs without creating a synthesis → coverage import edge.
//
// Match is suffix-based: `health.harvard.edu` matches `edu`, and
// `newsnetwork.mayoclinic.org` matches `mayoclinic.org`. Updates require a
// code change with PR review — domains drift slowly and we want the diff.

export const AUTHORITY_DOMAIN_SUFFIXES = [
  // Government / academic
  "gov",
  "edu",
  // Major medical authorities
  "mayoclinic.org",
  "nih.gov",
  "hopkinsmedicine.org",
  "harvard.edu",
  "clevelandclinic.org",
  // Mainstream health publishers
  "webmd.com",
  "healthline.com",
  "medlineplus.gov",
  // Major consumer / trade press
  "consumerreports.org",
  "forbes.com",
  "nytimes.com",
  "wsj.com",
  // Hearing-vertical non-profits and authoritative orgs
  "asha.org",       // American Speech-Language-Hearing Association
  "ncoa.org",       // National Council on Aging
  "hearingloss.org",// Hearing Loss Association of America
] as const;

export function isAuthorityDomain(domain: string): boolean {
  const d = domain.toLowerCase();
  return AUTHORITY_DOMAIN_SUFFIXES.some((s) => d === s || d.endsWith(`.${s}`));
}

// Forum / community signals — pages here usually compete for long-tail
// experiential queries (questions on lived experience), not editorial ones.
// Not "authority" in the editorial sense, but worth flagging separately for
// realism analysis: an editorial guide is unlikely to displace Reddit on
// "how does X feel" but can win on factual / commercial intent.
const FORUM_DOMAIN_SUFFIXES = [
  "reddit.com",
  "quora.com",
  "answers.com",
] as const;

export function isForumDomain(domain: string): boolean {
  const d = domain.toLowerCase();
  return FORUM_DOMAIN_SUFFIXES.some((s) => d === s || d.endsWith(`.${s}`));
}

export type CompetitorAuthorityTier = "authority" | "forum" | "competitor";

export function classifyCompetitorAuthority(domain: string): CompetitorAuthorityTier {
  if (isAuthorityDomain(domain)) return "authority";
  if (isForumDomain(domain)) return "forum";
  return "competitor";
}
