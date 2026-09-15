import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = join(root, "src");

function readSrc(relativePath: string): string {
  return readFileSync(join(srcRoot, relativePath), "utf8");
}

test("Customers navigation preserves the staff customer directory entry", () => {
  const nav = readSrc("ui/layouts/nav-config.ts");
  assert.match(nav, /label: "Customers"/);
  assert.match(nav, /href: "\/customers"/);
  assert.match(nav, /roles: \["admin", "manager", "mechanic"\]/);
});

test("directory starts at customer_directory and searches all contact identifiers", () => {
  const customers = readSrc("lib/customers.ts");
  assert.match(customers, /from\("customer_directory"\)/);
  assert.match(customers, /name\.ilike/);
  assert.match(customers, /email\.ilike/);
  assert.match(customers, /phone\.ilike/);
  assert.match(customers, /function escapedContactTerm/);
  assert.match(customers, /\\\\%_/);
  assert.match(customers, /if \(escaped\)/);
  assert.match(customers, /\.order\("name", \{ ascending: true \}\)/);
  assert.match(customers, /\.order\("id", \{ ascending: true \}\)/);
  assert.match(customers, /count: "exact"/);
  assert.match(customers, /loadCustomerDirectoryPage:/);
  assert.match(customers, /customers: \[\], count: 0, error: error\.message/);
  assert.doesNotMatch(customers, /createServiceRoleClient|SUPABASE_SERVICE_ROLE_KEY/);

  const page = readSrc("app/customers/page.tsx");
  assert.match(page, /loadCustomerDirectoryPage/);
  assert.match(page, /CUSTOMERS_DIRECTORY_PAGE_SIZE/);
  assert.match(page, /DataLoadError/);
  assert.match(page, /queryParam\.trim\(\)/);
});

test("directory table keeps URL state, explicitly submits search, opens customer drawer, and replaces stale rows", () => {
  const table = readSrc("app/customers/_components/CustomersLandingTable.tsx");
  assert.match(table, /SearchField/);
  assert.match(table, /onSubmit=\{\(nextQuery\) =>/);
  assert.match(table, /useTransition/);
  assert.match(table, /startTransition\(\(\) => router\.push\(buildHref\(nextQuery, 1\)\)\)/);
  assert.match(table, /startTransition\(\(\) => router\.push\(buildHref\(query, page\)\)\)/);
  assert.match(table, /params\.set\("customer", customerId\)/);
  assert.match(table, /ariaLabel="Search customers"/);
  assert.match(table, /<CustomersLandingTableSkeleton \/>/);
  assert.match(table, /HeaderCell>Name<\/Table.HeaderCell>\s*<Table.HeaderCell>Email<\/Table.HeaderCell>\s*<Table.HeaderCell>Phone<\/Table.HeaderCell>\s*<Table.HeaderCell>Birthday<\/Table.HeaderCell>/);
  assert.doesNotMatch(table, /customer_sync_list|HeaderCell>Google|HeaderCell>Holded|HeaderCell>Mailchimp/);

  const skeleton = readSrc("app/customers/_components/CustomersLandingTableSkeleton.tsx");
  assert.match(skeleton, /Table\.HeaderCell>Name/);
  assert.match(skeleton, /SkeletonText/);
});

test("customer drawer has authenticated details loading and the resolved destinations", () => {
  const action = readSrc("lib/customers/actions/customer-details-actions.ts");
  assert.match(action, /withAuth\(/);
  assert.match(action, /fetchCustomerDetails/);
  assert.match(action, /loadCustomerDetails/);

  const customers = readSrc("lib/customers.ts");
  assert.match(customers, /UUID_RE\.test\(customerId\)/);
  assert.match(customers, /from\("orders"\)/);
  assert.match(customers, /from\("bike_fits"\)/);
  assert.match(customers, /from\("customer_partner_history"\)/);
  assert.match(customers, /Promise\.all/);
  assert.match(customers, /loadCustomerDetails:/);

  const host = readSrc("components/customers/CustomerDetailsDrawerHost.tsx");
  assert.match(host, /searchParams\.get\("customer"\)/);
  assert.match(host, /cancelled/);
  assert.match(host, /fetchCustomerDetails/);

  const drawer = readSrc("components/customers/CustomerDetailsDrawer.tsx");
  assert.match(drawer, /params\.delete\("customer"\)/);
  assert.match(drawer, /CustomerDetailsDrawerSkeleton/);
  assert.match(drawer, /Couldn't load customer details/);
  assert.match(drawer, /Customer not found/);
  assert.match(drawer, /\/orders\?order=\$\{order\.id\}/);
  assert.match(drawer, /\/bike-fits\/\$\{fit\.id\}/);
  assert.match(drawer, /No qualifying partner order exists/);

  const orderDrawer = readSrc("components/orders/OrderDetailsDrawer.tsx");
  const orders = readSrc("lib/orders.ts");
  assert.match(orders, /customers \( id, name, email, phone, birthday \)/);
  assert.match(orderDrawer, /useHasRole\("admin", "manager", "mechanic"\)/);
  assert.match(orderDrawer, /href=\{`\/customers\?customer=\$\{order\.customers\.id\}`\}/);
  assert.match(orderDrawer, /focus-visible:ring-2/);
});

test("customer layout retains its authorization boundary and mounts the drawer host", () => {
  const layout = readSrc("app/customers/layout.tsx");
  assert.match(layout, /redirect\("\/login"\)/);
  assert.match(layout, /redirect\("\/pending"\)/);
  assert.match(layout, /redirect\("\/partner\/overview"\)/);
  assert.match(layout, /redirect\("\/unauthorized"\)/);
  assert.match(
    layout,
    /const ALLOWED_ROLES = \["admin", "manager", "mechanic"\]/,
  );
  assert.match(layout, /<CustomerDetailsDrawerHost \/>/);
  assert.match(layout, /<Suspense fallback=\{null\}>/);
});

test("mechanics get read-only Orders and Bike Fits access while partners remain redirected", () => {
  const nav = readSrc("ui/layouts/nav-config.ts");
  assert.match(nav, /label: "Orders"[\s\S]*roles: \["admin", "manager", "mechanic"\]/);
  assert.match(nav, /label: "Bike Fits"[\s\S]*roles: \["admin", "manager", "mechanic"\]/);

  for (const relativePath of ["app/orders/layout.tsx", "app/bike-fits/layout.tsx"]) {
    const layout = readSrc(relativePath);
    assert.match(layout, /const ALLOWED_ROLES = \["admin", "manager", "mechanic"\]/);
    assert.match(layout, /redirect\("\/partner\/overview"\)/);
  }
});

test("Bike Fits pass an explicit management capability and keep mechanic controls read-only", () => {
  const listPage = readSrc("app/bike-fits/all-bike-fits/page.tsx");
  const list = readSrc("app/bike-fits/all-bike-fits/_components/AllBikeFitsTable.tsx");
  const detailPage = readSrc("app/bike-fits/[id]/page.tsx");
  const detail = readSrc("app/bike-fits/_components/BikeFitDetail.tsx");
  const editPage = readSrc("app/bike-fits/[id]/edit/page.tsx");
  const reports = readSrc("app/bike-fits/_components/BikeFitReportActions.tsx");

  assert.match(listPage, /const canManage = role === "admin" \|\| role === "manager"/);
  assert.match(listPage, /canManage=\{canManage\}/);
  assert.match(list, /canManage: boolean/);
  assert.match(list, /\{canManage \? \(/);
  assert.match(list, /canManage && isEditableStatus/);
  assert.match(detailPage, /canManage=\{canManage\}/);
  assert.match(detail, /canManage: boolean/);
  assert.match(detail, /\{canManage \? \(/);
  assert.match(editPage, /if \(role === "mechanic"\)/);
  assert.match(editPage, /redirect\(`\/bike-fits\/\$\{id\}`\)/);
  assert.match(reports, /canManage: boolean/);
  assert.match(reports, /\{canManage \? \(/);
  assert.match(reports, /\) : canManage \? \(/);
  assert.match(reports, /Download PDF/);
});

test("Bike Fit server actions authorize every mutation and report generation or email", () => {
  const bikeFitActions = readSrc("lib/bike-fit/actions/bike-fit-actions.ts");
  const reportActions = readSrc("lib/bike-fit/actions/report-actions.ts");

  assert.match(bikeFitActions, /requireBikeFitManagementAccess/);
  for (const action of [
    "createBikeFitDraftAction",
    "saveBikeFitDraftAction",
    "completeBikeFitAction",
    "unlockBikeFitForEditAction",
    "deleteBikeFitAction",
  ]) {
    assert.match(
      bikeFitActions,
      new RegExp(`async function ${action}[\\s\\S]*?requireBikeFitManagementAccess\\(\\)`),
    );
  }
  assert.match(reportActions, /requireBikeFitReportManagementAccess/);
  assert.match(reportActions, /generateBikeFitReportAction[\s\S]*?requireBikeFitReportManagementAccess\(\)/);
  assert.match(reportActions, /sendBikeFitReportEmailAction[\s\S]*?requireBikeFitReportManagementAccess\(\)/);
  assert.doesNotMatch(
    reportActions.match(/getBikeFitReportDownloadUrlAction[\s\S]*?(?=\/\*\*|$)/)?.[0] ?? "",
    /requireBikeFitReportManagementAccess/,
  );
});

test("mechanic migration is idempotent, status-only, and preserves private storage writes", () => {
  const migration = readFileSync(
    join(root, "supabase/migrations/20260904130000_mechanic_customer_read_access.sql"),
    "utf8",
  );

  assert.match(migration, /DROP POLICY IF EXISTS "Mechanics can read orders with bike tasks"/);
  assert.match(migration, /CREATE POLICY "Mechanics can read all orders"/);
  assert.match(migration, /CREATE POLICY "Mechanics can read all customers"/);
  assert.match(migration, /CREATE POLICY "Mechanics can read all bike fits"/);
  assert.match(migration, /CREATE POLICY "Staff and mechanics can read customer sync"/);
  assert.match(migration, /GRANT SELECT \([\s\S]*google_status[\s\S]*mailchimp_error[\s\S]*\) ON TABLE public\.customer_sync TO authenticated/);
  assert.doesNotMatch(migration, /google_id[\s\S]*ON TABLE public\.customer_sync TO authenticated/);
  assert.match(migration, /CREATE POLICY "Staff and mechanics can view bike fit reference images"/);
  assert.doesNotMatch(migration, /FOR INSERT[\s\S]*mechanic|FOR UPDATE[\s\S]*mechanic|FOR DELETE[\s\S]*mechanic/);
});

test("migration uses security-invoker views, qualified partners, grants, and indexes", () => {
  const migration = readFileSync(
    join(root, "supabase/migrations/20260904120000_customer_directory.sql"),
    "utf8",
  );
  assert.match(migration, /CREATE OR REPLACE VIEW public\.customer_directory/);
  assert.match(migration, /security_invoker = true/);
  assert.match(migration, /FROM public\.customers AS c/);
  assert.match(migration, /LEFT JOIN public\.customer_sync AS s/);
  assert.match(migration, /CREATE OR REPLACE VIEW public\.customer_partner_history/);
  assert.match(migration, /SELECT DISTINCT/);
  assert.match(migration, /NULLIF\(btrim\(o\.partner_promo\), ''\) IS NOT NULL/);
  assert.match(migration, /GRANT SELECT ON TABLE public\.customer_directory TO authenticated/);
  assert.match(migration, /GRANT SELECT ON TABLE public\.customer_partner_history TO authenticated/);
  assert.match(migration, /CREATE INDEX IF NOT EXISTS customers_directory_name_id_idx/);
  assert.match(migration, /CREATE INDEX IF NOT EXISTS orders_customer_created_at_id_idx/);
  assert.match(migration, /CREATE INDEX IF NOT EXISTS bike_fits_customer_date_fit_number_idx/);
});
