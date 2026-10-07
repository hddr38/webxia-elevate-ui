import { expect, test } from "@playwright/test";
import { createRequire } from "module";
import { readFileSync } from "fs";
import path from "path";

const require = createRequire(path.join(process.cwd(), "package.json"));

interface SerovalApi {
  fromCrossJSON(value: unknown, options: Record<string, unknown>): unknown;
}

const seroval = require("seroval") as SerovalApi;

const DESERIALIZE_OPTIONS = {
  plugins: [],
  refs: new Map<number, unknown>(),
  features: 0,
  disabledFeatures: 0,
  depthLimit: 128,
};

const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

function readDotEnvValue(key: string): string {
  try {
    const raw = readFileSync(path.join(process.cwd(), ".env"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (match && match[1] === key) return match[2];
    }
  } catch {
    return "";
  }
  return "";
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? readDotEnvValue("VITE_SUPABASE_URL");
const SERVICE_KEY =
  SUPABASE_SERVICE_ROLE_KEY !== ""
    ? SUPABASE_SERVICE_ROLE_KEY
    : readDotEnvValue("SUPABASE_SERVICE_ROLE_KEY");
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "webxia33@gmail.com";

async function mintAdminAccessToken(): Promise<string> {
  const linkResponse = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ type: "magiclink", email: ADMIN_EMAIL }),
  });
  if (!linkResponse.ok) {
    throw new Error(`generate_link failed: ${linkResponse.status} ${await linkResponse.text()}`);
  }
  const linkBody = (await linkResponse.json()) as { action_link?: string };
  if (!linkBody.action_link) throw new Error("generate_link returned no action_link");

  const redirect = await fetch(linkBody.action_link, { redirect: "manual" });
  const location = redirect.headers.get("location");
  if (redirect.status !== 303 || !location) {
    throw new Error(`magiclink follow failed: ${redirect.status}`);
  }
  const fragment = new URLSearchParams(new URL(location).hash.slice(1));
  const token = fragment.get("access_token");
  if (!token) throw new Error("no access_token in magiclink redirect");
  return token;
}

function decodeBody(body: string): { ok: boolean; value?: unknown; snippet: string } {
  const snippet = body.slice(0, 300);
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return { ok: false, snippet };
  }
  try {
    if (parsed && typeof parsed === "object" && "t" in parsed) {
      return { ok: true, value: seroval.fromCrossJSON(parsed, DESERIALIZE_OPTIONS), snippet };
    }
    return { ok: true, value: parsed, snippet };
  } catch {
    return { ok: false, snippet };
  }
}

function asListLeadsPayload(value: unknown): { data: unknown[]; total: number } | null {
  if (!value || typeof value !== "object") return null;
  const outer = value as { result?: unknown };
  const inner =
    outer.result && typeof outer.result === "object"
      ? outer.result
      : (value as { data?: unknown; total?: unknown });
  const payload = inner as { data?: unknown; total?: unknown };
  if (Array.isArray(payload.data) && typeof payload.total === "number") {
    return { data: payload.data, total: payload.total };
  }
  return null;
}

test("@integration real server function returns 200 with session", async ({ page, context }) => {
  expect(SUPABASE_URL, "VITE_SUPABASE_URL manquant (.env / env)").not.toBe("");
  expect(SERVICE_KEY, "SUPABASE_SERVICE_ROLE_KEY manquant (.env / env)").not.toBe("");

  const accessToken = await mintAdminAccessToken();
  const supaRef = new URL(SUPABASE_URL).host.split(".")[0];
  const sessionJson = JSON.stringify({
    access_token: accessToken,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
  });
  const cookieValue = "base64-" + Buffer.from(sessionJson, "utf8").toString("base64url");

  await context.addCookies([
    {
      name: `sb-${supaRef}-auth-token`,
      value: cookieValue,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    },
  ]);

  const fnStatuses: number[] = [];
  const fnUrls = new Set<string>();
  page.on("response", (response) => {
    const url = response.url();
    if (url.includes("/_serverFn/")) {
      fnStatuses.push(response.status());
      fnUrls.add(url);
    }
  });

  await page.goto("/admin/leads");

  await expect(page.getByRole("heading", { name: "Leads", exact: true })).toBeVisible();
  await expect(page.getByText("Échec du chargement. Réessayez.")).toHaveCount(0);

  await expect.poll(() => fnStatuses.length, { timeout: 15_000 }).toBeGreaterThan(0);
  expect(fnStatuses.every((status) => status >= 200 && status < 300)).toBe(true);
  expect(fnStatuses).not.toContain(401);

  const urls = [...fnUrls].slice(0, 5);
  const fetched = await page.evaluate(async (targets: string[]) => {
    const results: { url: string; status: number; body: string }[] = [];
    for (const target of targets) {
      const response = await fetch(target, {
        headers: { Accept: "application/json", "x-tsr-serverfn": "true" },
      });
      results.push({ url: target, status: response.status, body: await response.text() });
    }
    return results;
  }, urls);

  expect(fetched.length).toBeGreaterThan(0);

  let listLeadsPayload: { data: unknown[]; total: number } | null = null;
  const diagnostics: string[] = [];
  for (const item of fetched) {
    expect(item.status, `server fn ${item.url}`).toBe(200);
    const decoded = decodeBody(item.body);
    if (!decoded.ok) {
      diagnostics.push(`undecodable ${item.url}: ${decoded.snippet}`);
      continue;
    }
    const payload = asListLeadsPayload(decoded.value);
    if (payload) {
      listLeadsPayload = payload;
      break;
    }
    diagnostics.push(`not listLeads ${item.url}: ${decoded.snippet}`);
  }

  expect(listLeadsPayload, `aucune réponse listLeads — ${diagnostics.join(" | ")}`).not.toBeNull();
  const leadsPayload = listLeadsPayload as { data: unknown[]; total: number };
  expect(leadsPayload.total).toBeGreaterThanOrEqual(0);
  expect(Array.isArray(leadsPayload.data)).toBe(true);
});
