import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("migration executa e RLS isola clientes, RPCs e tokens", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role bypassrls;
      create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth to authenticated, service_role;
      grant execute on function auth.uid() to authenticated, service_role;
      alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
      alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
    `);
    for (const file of (await readdir("supabase/migrations")).filter(f => f.endsWith(".sql")).sort()) {
      await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
    }
    const result = await db.exec(await readFile("supabase/tests/rls.sql", "utf8"));
    assert.ok(result.some(r => r.rows.some(row => (row as { result?: string }).result === "RLS OK")));
    const syncResult = await db.exec(await readFile("supabase/tests/sync.sql", "utf8"));
    assert.ok(syncResult.some(r => r.rows.some(row => (row as { result?: string }).result === "SYNC OK")));
    const reporting = await db.exec(await readFile("supabase/tests/reporting.sql", "utf8"));
    assert.ok(reporting.some(r => r.rows.some(row => (row as { result?: string }).result === "REPORTING OK")));
    const management = await db.exec(await readFile("supabase/tests/campaign_management.sql", "utf8"));
    assert.ok(management.some(r => r.rows.some(row => (row as { result?: string }).result === "MANAGEMENT OK")));
    const removal = await db.exec(await readFile("supabase/tests/connection_removal.sql", "utf8"));
    assert.ok(removal.some(r => r.rows.some(row => (row as { result?: string }).result === "REMOVAL OK")));
  } finally { await db.close(); }
});
