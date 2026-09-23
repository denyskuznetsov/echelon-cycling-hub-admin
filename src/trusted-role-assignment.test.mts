import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { getVisibleNavItems } from "./ui/layouts/nav-config.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const readSource = (path: string) => readFileSync(join(root, path), "utf8");

test("pending accounts have no navigation while active roles retain their routes", () => {
  assert.deepEqual(getVisibleNavItems(undefined), []);
  assert.deepEqual(getVisibleNavItems("mechanic").map((item) => item.href), [
    "/dashboard", "/orders", "/bike-fits/all-bike-fits", "/customers", "/workshop", "/contact",
  ]);
});

test("vendor paths check active profile access before their external clients", () => {
  const links = readSource("src/app/api/links/create/route.ts");
  const contact = readSource("src/lib/contact.ts");
  const deleteLink = readSource("src/lib/marketing-links-actions.ts");

  assert.ok(links.indexOf("getActiveProfileAccess") < links.indexOf("await request.json"));
  assert.ok(contact.indexOf("getActiveProfileAccess") < contact.indexOf("new Resend"));
  assert.ok(deleteLink.indexOf("getActiveProfileAccess") < deleteLink.indexOf("api.short.io"));
});

test("the forward migration makes Auth-created profiles pending and blocks ordinary writes", () => {
  const migration = readSource("supabase/migrations/20260916084243_trusted_role_assignment.sql");
  assert.match(migration, /ALTER COLUMN role DROP DEFAULT/);
  assert.match(migration, /ALTER COLUMN role DROP NOT NULL/);
  assert.match(migration, /VALUES \([\s\S]*NULL,[\s\S]*NULL[\s\S]*\)/);
  assert.match(migration, /REVOKE INSERT, UPDATE, DELETE ON TABLE public\.profiles FROM anon, authenticated/);
});
