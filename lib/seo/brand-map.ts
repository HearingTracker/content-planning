// Brand / retailer / product-family detection for SEO query clustering.
//
// Used to split queries into clustering groups so "phonak hearing aids" never
// clusters with "best hearing aids for seniors" even when their embeddings
// are close. Static for Phase 1A; Storyblok-managed in Phase 4 if maintenance
// becomes painful.
//
// Detection is deliberately conservative: word-boundary regexes against a
// lowercased query, multi-word phrases matched as a whole. Both the key (what
// the regex looks for) and the value (the canonical normalized form stored
// on cluster rows) are explicit, so renames stay stable.

type BrandRule = {
  pattern: RegExp;          // word-boundary regex
  brand: string;            // canonical brand id
};

type RetailerRule = {
  pattern: RegExp;
  retailer: string;
};

type ProductFamilyRule = {
  pattern: RegExp;
  family: string;
  brand: string;
};

const wb = (s: string) => new RegExp(`\\b${s.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`, "i");

const BRAND_RULES: BrandRule[] = [
  { pattern: wb("phonak"),         brand: "phonak" },
  { pattern: wb("oticon"),         brand: "oticon" },
  { pattern: wb("resound"),        brand: "resound" },
  { pattern: wb("widex"),          brand: "widex" },
  { pattern: wb("signia"),         brand: "signia" },
  { pattern: wb("starkey"),        brand: "starkey" },
  { pattern: wb("unitron"),        brand: "unitron" },
  { pattern: wb("rexton"),         brand: "rexton" },
  { pattern: wb("philips"),        brand: "philips" },
  { pattern: wb("jabra"),          brand: "jabra" },
  { pattern: wb("beltone"),        brand: "beltone" },
  { pattern: wb("miracle-ear"),    brand: "miracle-ear" },
  { pattern: wb("miracle ear"),    brand: "miracle-ear" },
  { pattern: wb("audibel"),        brand: "audibel" },
  { pattern: wb("audicus"),        brand: "audicus" },
  { pattern: wb("eargo"),          brand: "eargo" },
  { pattern: wb("lexie"),          brand: "lexie" },
  { pattern: wb("sony"),           brand: "sony" },
  { pattern: wb("bose"),           brand: "bose" },
  { pattern: wb("sennheiser"),     brand: "sennheiser" },
  { pattern: wb("mdhearing"),      brand: "mdhearing" },
  { pattern: wb("md hearing"),     brand: "mdhearing" },
  { pattern: wb("lucid"),          brand: "lucid" },
  { pattern: wb("nuheara"),        brand: "nuheara" },
  // Apple is tricky; only match when AirPods context is present, since "apple"
  // alone in hearing-aid queries usually refers to AirPods. AirPods is the
  // hearing-aid–relevant signal.
  { pattern: wb("airpods"),        brand: "apple" },
];

const RETAILER_RULES: RetailerRule[] = [
  { pattern: wb("costco"),               retailer: "costco" },
  { pattern: wb("kirkland signature"),   retailer: "costco" },
  { pattern: wb("kirkland"),             retailer: "costco" },
  { pattern: wb("hear\\.com"),           retailer: "hear.com" },
  { pattern: wb("ziphearing"),           retailer: "ziphearing" },
  { pattern: wb("zip hearing"),          retailer: "ziphearing" },
  { pattern: wb("yes hearing"),          retailer: "yes-hearing" },
];

// Product families map to a brand; their presence implies the brand even when
// the brand name itself isn't in the query. We deliberately omit ambiguous
// product names like Oticon Real / More / Intent — too many false positives
// in everyday English. Add them back with multi-word patterns ("oticon real")
// if we observe specific queries that need them.
const PRODUCT_FAMILY_RULES: ProductFamilyRule[] = [
  { pattern: wb("lumity"),       family: "lumity",      brand: "phonak" },
  { pattern: wb("infinio"),      family: "infinio",     brand: "phonak" },
  { pattern: wb("naida"),        family: "naida",       brand: "phonak" },
  { pattern: wb("audeo"),        family: "audeo",       brand: "phonak" },
  { pattern: wb("paradise"),     family: "paradise",    brand: "phonak" },
  { pattern: wb("oticon real"),  family: "real",        brand: "oticon" },
  { pattern: wb("oticon intent"),family: "intent",      brand: "oticon" },
  { pattern: wb("oticon more"),  family: "more",        brand: "oticon" },
  { pattern: wb("oticon zeal"),  family: "zeal",        brand: "oticon" },
  { pattern: wb("evolv ai"),     family: "evolv-ai",    brand: "starkey" },
  { pattern: wb("omega ai"),     family: "omega-ai",    brand: "starkey" },
  { pattern: wb("genesis ai"),   family: "genesis-ai",  brand: "starkey" },
  { pattern: wb("livio"),        family: "livio",       brand: "starkey" },
  // Add more iteratively as we see them in real queries.
];

export type BrandDetection = {
  is_branded: boolean;
  brand: string | null;
  retailer: string | null;
  product_family: string | null;
  /** Stable cluster-grouping key: queries with the same group_key may cluster
   *  together; queries with different group_keys never do. */
  group_key: string | null;
};

export function detectBrand(query: string): BrandDetection {
  const q = query.toLowerCase();

  // Product family checks first — they're more specific and imply a brand.
  let brand: string | null = null;
  let product_family: string | null = null;
  for (const rule of PRODUCT_FAMILY_RULES) {
    if (rule.pattern.test(q)) {
      product_family = rule.family;
      brand = rule.brand;
      break;
    }
  }

  if (!brand) {
    for (const rule of BRAND_RULES) {
      if (rule.pattern.test(q)) {
        brand = rule.brand;
        break;
      }
    }
  }

  let retailer: string | null = null;
  for (const rule of RETAILER_RULES) {
    if (rule.pattern.test(q)) {
      retailer = rule.retailer;
      break;
    }
  }

  // Group key: brand wins (most editorially meaningful), then product family,
  // then retailer, then null (generic). Generic queries cluster only with
  // other generic queries.
  let group_key: string | null = null;
  if (brand) group_key = `brand:${brand}`;
  else if (product_family) group_key = `family:${product_family}`;
  else if (retailer) group_key = `retailer:${retailer}`;

  return {
    is_branded: brand !== null || product_family !== null,
    brand,
    retailer,
    product_family,
    group_key,
  };
}
