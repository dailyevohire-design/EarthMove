/**
 * Generates docs/PROD_STATE.md — a point-in-time snapshot of production:
 * Vercel deployment, DB schema stats, migrations, enums, recent commits, cron schedules.
 * Run via: pnpm tsx scripts/generate-prod-state.ts
 * Env:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  — required for DB sections
 *   VERCEL_TOKEN, VERCEL_PROJECT_ID          — optional, for last prod deploy
 */
import { createClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT_PATH = "docs/PROD_STATE.md";
const MIGRATIONS_DIR = "supabase/migrations";
const VERCEL_JSON = "vercel.json";
const BACKLOG = "docs/SPECS_BACKLOG.md";

type Section = { title: string; body: string };
const sections: Section[] = [];

function warn(msg: string) {
  console.warn(`warn: ${msg}`);
}

async function fetchDbStats(): Promise<Section> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    warn("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing — DB section will be empty");
    return {
      title: "Schema state",
      body: "_(auto-populated on next merge to main — DB credentials not available in this run)_\n",
    };
  }

  const sb = createClient(url, key);
  const lines: string[] = [];

  try {
    const { data: tables, error: te } = await sb
      .from("information_schema.tables" as unknown as string)
      .select("table_name", { count: "exact", head: true })
      .eq("table_schema", "public");
    if (te) throw te;
    lines.push(`- public schema table count: ${tables ? "see count below" : "unknown"}`);
  } catch (e) {
    lines.push(`- public schema table count: unavailable (${(e as Error).message})`);
  }

  try {
    const { data } = await sb.rpc("pg_public_counts" as unknown as string);
    if (data) {
      lines.push(`- counts rpc: ${JSON.stringify(data)}`);
    }
  } catch {
    // rpc may not exist, skip silently
  }

  return { title: "Schema state", body: lines.join("\n") + "\n" };
}

function collectMigrations(): Section {
  if (!existsSync(MIGRATIONS_DIR)) {
    return { title: "Migrations", body: "_(no supabase/migrations directory found)_\n" };
  }
  const entries = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const rows = entries.map((name) => {
    const full = join(MIGRATIONS_DIR, name);
    const size = statSync(full).size;
    return `- \`${name}\` (${size} bytes)`;
  });
  return {
    title: "Migrations",
    body: `${rows.length} migration files\n\n${rows.join("\n")}\n`,
  };
}

function recentCommits(): Section {
  try {
    const out = execSync("git log --format='%H %ai %s' origin/main -10", {
      encoding: "utf8",
    });
    return { title: "Recent commits to main", body: "```\n" + out + "```\n" };
  } catch (e) {
    return { title: "Recent commits to main", body: `_(git log failed: ${(e as Error).message})_\n` };
  }
}

function cronSchedules(): Section {
  if (!existsSync(VERCEL_JSON)) {
    return { title: "Cron schedules", body: "_(no vercel.json)_\n" };
  }
  const raw = JSON.parse(readFileSync(VERCEL_JSON, "utf8")) as { crons?: Array<{ path: string; schedule: string }> };
  const crons = raw.crons ?? [];
  if (crons.length === 0) {
    return { title: "Cron schedules", body: "_(no crons configured)_\n" };
  }
  const rows = crons.map((c) => `- \`${c.path}\` — \`${c.schedule}\``);
  return { title: "Cron schedules", body: rows.join("\n") + "\n" };
}

async function lastProdDeploy(): Promise<Section> {
  const token = process.env.VERCEL_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  if (!token || !projectId) {
    warn("VERCEL_TOKEN or VERCEL_PROJECT_ID missing — deployment section empty");
    return {
      title: "Production deployment",
      body: "_(auto-populated on next merge to main — VERCEL_TOKEN not set)_\n",
    };
  }
  try {
    const res = await fetch(
      `https://api.vercel.com/v6/deployments?projectId=${projectId}&target=production&limit=1`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) {
      return {
        title: "Production deployment",
        body: `_(Vercel API returned ${res.status})_\n`,
      };
    }
    const json = (await res.json()) as {
      deployments?: Array<{ uid: string; url: string; createdAt: number; meta?: { githubCommitSha?: string } }>;
    };
    const d = json.deployments?.[0];
    if (!d) return { title: "Production deployment", body: "_(no deployments found)_\n" };
    const when = new Date(d.createdAt).toISOString();
    const sha = d.meta?.githubCommitSha ?? "unknown";
    return {
      title: "Production deployment",
      body: `- SHA: \`${sha}\`\n- URL: ${d.url}\n- Deployed: ${when}\n`,
    };
  } catch (e) {
    return { title: "Production deployment", body: `_(error: ${(e as Error).message})_\n` };
  }
}

async function userRoleEnum(): Promise<Section> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return { title: "user_role enum values", body: "_(DB credentials not available)_\n" };
  }
  const sb = createClient(url, key);
  try {
    const { data, error } = await sb.rpc("enum_range_text" as unknown as string, {
      enum_name: "user_role",
    });
    if (error) throw error;
    return {
      title: "user_role enum values",
      body: data ? `\`\`\`\n${JSON.stringify(data)}\n\`\`\`\n` : "_(enum introspection returned no data)_\n",
    };
  } catch {
    return {
      title: "user_role enum values",
      body: "_(enum introspection rpc not available — add SQL function `enum_range_text(enum_name text)` to expose)_\n",
    };
  }
}

function infraDebt(): Section {
  if (!existsSync(BACKLOG)) {
    return {
      title: "Open infrastructure debt",
      body: "_(no docs/SPECS_BACKLOG.md yet)_\n",
    };
  }
  return {
    title: "Open infrastructure debt",
    body: readFileSync(BACKLOG, "utf8"),
  };
}

async function main() {
  const now = new Date().toISOString();
  sections.push(await lastProdDeploy());
  sections.push(await fetchDbStats());
  sections.push(collectMigrations());
  sections.push(await userRoleEnum());
  sections.push(recentCommits());
  sections.push(cronSchedules());
  sections.push(infraDebt());

  const doc =
    `# PROD_STATE\n\n` +
    `_Auto-generated. Do not edit by hand — runs on push to main via \`.github/workflows/prod-state-update.yml\`._\n\n` +
    `Last updated: ${now}\n\n` +
    sections.map((s) => `## ${s.title}\n\n${s.body}`).join("\n") +
    "\n";

  writeFileSync(OUT_PATH, doc);
  console.log(`wrote ${OUT_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
