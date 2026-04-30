// Google Search Console API: JWT-signed service-account auth + paginated query.
// Service account must be added to the property as a delegated user with at
// least "Restricted" permission.

import crypto from "node:crypto";

type ServiceAccount = {
  client_email: string;
  private_key: string;
};

export type GSCRow = {
  keys: string[];        // [query, page]
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

function loadServiceAccount(): ServiceAccount {
  // Prefer inline env (works on Vercel without filesystem access)
  const inline = process.env.GSC_SERVICE_ACCOUNT_JSON;
  if (inline) {
    try {
      return JSON.parse(inline) as ServiceAccount;
    } catch (err) {
      throw new Error(`GSC_SERVICE_ACCOUNT_JSON is not valid JSON: ${(err as Error).message}`);
    }
  }
  throw new Error("GSC_SERVICE_ACCOUNT_JSON env var is required");
}

async function getAccessToken(): Promise<string> {
  const sa = loadServiceAccount();
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/webmasters.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })).toString("base64url");
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(`${header}.${payload}`);
  const jwt = `${header}.${payload}.${signer.sign(sa.private_key, "base64url")}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  const data = (await res.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!data.access_token) {
    throw new Error(`GSC token error: ${data.error ?? ""} ${data.error_description ?? JSON.stringify(data)}`);
  }
  return data.access_token;
}

export async function fetchGSCRows(opts: {
  siteUrl: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  rowLimit?: number;
  maxRows?: number;
}): Promise<GSCRow[]> {
  const token = await getAccessToken();
  const rowLimit = opts.rowLimit ?? 5000;
  const maxRows = opts.maxRows ?? 100000;
  const out: GSCRow[] = [];
  for (let startRow = 0; startRow < maxRows; startRow += rowLimit) {
    const res = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(opts.siteUrl)}/searchAnalytics/query`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: opts.startDate,
          endDate: opts.endDate,
          dimensions: ["query", "page"],
          rowLimit,
          startRow,
          dataState: "final",
        }),
      },
    );
    if (!res.ok) throw new Error(`GSC ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { rows?: GSCRow[] };
    const rows = data.rows ?? [];
    out.push(...rows);
    if (rows.length < rowLimit) break;
  }
  return out;
}
