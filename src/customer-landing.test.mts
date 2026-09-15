import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  InvalidLandingCustomerError,
  parseLandingCustomer,
  type CustomerPassport,
} from "./lib/booqable/parse-landing-customer.ts";
import {
  destNextAction,
  phonesMatch,
} from "./lib/customer-landing/dest-error.ts";
import { googleContactPerson, writeGoogleContact } from "./lib/customer-landing/google.ts";
import { holdedContactBody, writeHoldedContact } from "./lib/customer-landing/holded.ts";
import { landBooqableCustomer } from "./lib/customer-landing/land-customer.ts";
import {
  REVIEW_REQUEST_TAG,
  mailchimpDataCenter,
  mailchimpMemberBody,
  mailchimpSubscriberHash,
  tagMailchimpReviewRequest,
  writeMailchimpMember,
} from "./lib/customer-landing/mailchimp.ts";
import { tagReviewRequestForOrder } from "./lib/customer-landing/tag-review-request.ts";
import { identityUpsertRow } from "./lib/customer-landing/landing-store.ts";
import type {
  DestIds,
  DestName,
  DestWriter,
  LandingStatuses,
  LandingStore,
} from "./lib/customer-landing/types.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = join(root, "src");

function readSrc(relativePath: string): string {
  return readFileSync(join(srcRoot, relativePath), "utf8");
}

function collectTsFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTsFiles(path));
    } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
      files.push(path);
    }
  }
  return files;
}

function loadLandingFixture(): unknown {
  return JSON.parse(
    readFileSync(
      join(srcRoot, "lib/booqable/fixtures/landing-customer.json"),
      "utf8",
    ),
  );
}

function passport(overrides: Partial<CustomerPassport> = {}): CustomerPassport {
  return {
    booqableCustomerId: "cust-land-1",
    name: "Landing Rider",
    email: "landing@example.test",
    phone: "+34000000000",
    birthday: "1990-05-17",
    address: {
      street: "Carrer de Mallorca 1",
      city: "Barcelona",
      region: "Catalonia",
      zip: "08001",
      country: "Spain",
    },
    ...overrides,
  };
}

function memoryStore(initial: DestIds = { google: null, holded: null, mailchimp: null }): LandingStore & {
  identities: CustomerPassport[];
  saved: LandingStatuses[];
} {
  const identities: CustomerPassport[] = [];
  const saved: LandingStatuses[] = [];
  let storedIds = { ...initial };
  return {
    identities,
    saved,
    async upsertIdentity(next) {
      identities.push(next);
      return { storedIds: { ...storedIds } };
    },
    async saveStatuses(_id, statuses) {
      saved.push(statuses);
      storedIds = {
        google: statuses.google.id,
        holded: statuses.holded.id,
        mailchimp: statuses.mailchimp.id,
      };
    },
  };
}

function writersFromResults(
  results: Record<DestName, { ok: true; destId: string } | { ok: false; error: string }>,
  seen: Array<{ name: DestName; storedId: string | null }>,
): DestWriter[] {
  return (["google", "holded", "mailchimp"] as const).map((name) => ({
    name,
    async write({ storedId }) {
      seen.push({ name, storedId });
      return results[name];
    },
  }));
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("upsertIdentity persists address as a unit and leaves it when passport.address is null", () => {
  const full = identityUpsertRow(passport());
  assert.equal(full.address_street, "Carrer de Mallorca 1");
  assert.equal(full.address_city, "Barcelona");
  assert.equal(full.address_region, "Catalonia");
  assert.equal(full.address_zip, "08001");
  assert.equal(full.address_country, "Spain");

  const cityOnly = identityUpsertRow(
    passport({
      address: {
        street: null,
        city: "Barcelona",
        region: null,
        zip: null,
        country: null,
      },
    }),
  );
  assert.equal(cityOnly.address_city, "Barcelona");
  assert.equal("address_street" in cityOnly, true);
  assert.equal("address_region" in cityOnly, true);
  assert.equal("address_zip" in cityOnly, true);
  assert.equal("address_country" in cityOnly, true);
  assert.equal(cityOnly.address_street, null);
  assert.equal(cityOnly.address_region, null);
  assert.equal(cityOnly.address_zip, null);
  assert.equal(cityOnly.address_country, null);

  const noAddress = identityUpsertRow(passport({ address: null }));
  assert.equal("address_street" in noAddress, false);
  assert.equal("address_city" in noAddress, false);
  assert.equal("address_region" in noAddress, false);
  assert.equal("address_zip" in noAddress, false);
  assert.equal("address_country" in noAddress, false);
});

test("landing parser maps GET passport including address and ignores form-only fields", () => {
  const parsed = parseLandingCustomer(loadLandingFixture());
  assert.equal(parsed.booqableCustomerId, "cust-land-1");
  assert.equal(parsed.name, "Landing Rider");
  assert.equal(parsed.email, "landing@example.test");
  assert.equal(parsed.phone, "+34000000000");
  assert.equal(parsed.birthday, "1990-05-17");
  assert.deepEqual(parsed.address, {
    street: "Carrer de Mallorca 1",
    city: "Barcelona",
    region: "Catalonia",
    zip: "08001",
    country: "Spain",
  });

  assert.throws(() => parseLandingCustomer({ event: "customer.created", "data[name]": "Form Name" }), InvalidLandingCustomerError);
  assert.throws(() => parseLandingCustomer({ data: { id: "x", type: "orders" } }), InvalidLandingCustomerError);
});

test("company records parse like people", () => {
  const doc = loadLandingFixture() as {
    data: { attributes: Record<string, unknown> };
  };
  doc.data.attributes.legal_type = "commercial";
  doc.data.attributes.name = "Echelon SL";
  const parsed = parseLandingCustomer(doc);
  assert.equal(parsed.name, "Echelon SL");
  assert.equal(parsed.email, "landing@example.test");
  assert.ok(parsed.address);
});

test("land uses GET by webhook id, not the form body", async () => {
  const store = memoryStore();
  const seen: Array<{ name: DestName; storedId: string | null }> = [];
  let fetchedId: string | null = null;
  const result = await landBooqableCustomer("cust-land-1", {
    store,
    fetchCustomer: async (id) => {
      fetchedId = id;
      return loadLandingFixture();
    },
    writers: writersFromResults(
      {
        google: { ok: true, destId: "people/c-1" },
        holded: { ok: true, destId: "holded-1" },
        mailchimp: { ok: true, destId: "mc-1" },
      },
      seen,
    ),
  });
  assert.equal(fetchedId, "cust-land-1");
  assert.equal(result.ok, true);
  if (!result.ok || result.ignored) throw new Error("expected landed statuses");
  assert.equal(store.identities[0]?.name, "Landing Rider");
  assert.equal(store.identities[0]?.address?.street, "Carrer de Mallorca 1");
  assert.equal(result.statuses.google.status, "green");
  assert.equal(result.statuses.holded.status, "green");
  assert.equal(result.statuses.mailchimp.status, "green");
});

test("second land reuses stored dest ids", async () => {
  const store = memoryStore({
    google: "people/c-1",
    holded: "holded-1",
    mailchimp: "mc-1",
  });
  const seen: Array<{ name: DestName; storedId: string | null }> = [];
  const result = await landBooqableCustomer("cust-land-1", {
    store,
    fetchCustomer: async () => loadLandingFixture(),
    writers: writersFromResults(
      {
        google: { ok: true, destId: "people/c-1" },
        holded: { ok: true, destId: "holded-1" },
        mailchimp: { ok: true, destId: "mc-1" },
      },
      seen,
    ),
  });
  assert.equal(result.ok, true);
  assert.deepEqual(
    seen.map((row) => row.storedId),
    ["people/c-1", "holded-1", "mc-1"],
  );
});

test("Mailchimp failure leaves the other dests green", async () => {
  const store = memoryStore();
  const result = await landBooqableCustomer("cust-land-1", {
    store,
    fetchCustomer: async () => loadLandingFixture(),
    writers: writersFromResults(
      {
        google: { ok: true, destId: "people/c-1" },
        holded: { ok: true, destId: "holded-1" },
        mailchimp: {
          ok: false,
          error: destNextAction("Mailchimp", "audience rejected the member (400)."),
        },
      },
      [],
    ),
  });
  assert.equal(result.ok, true);
  if (!result.ok || result.ignored) throw new Error("expected landed statuses");
  assert.equal(result.statuses.google.status, "green");
  assert.equal(result.statuses.holded.status, "green");
  assert.equal(result.statuses.mailchimp.status, "red");
  assert.match(result.statuses.mailchimp.error ?? "", /Mailchimp/);
  assert.match(result.statuses.mailchimp.error ?? "", /Save the customer in Booqable again/);
});

test("preview env writes nothing", async () => {
  let fetched = false;
  let wrote = false;
  const result = await landBooqableCustomer("cust-land-1", {
    env: { VERCEL_ENV: "preview" },
    fetchCustomer: async () => {
      fetched = true;
      return loadLandingFixture();
    },
    writers: [
      {
        name: "google",
        async write() {
          wrote = true;
          return { ok: true, destId: "x" };
        },
      },
    ],
    store: memoryStore(),
  });
  assert.deepEqual(result, { ok: true, ignored: true });
  assert.equal(fetched, false);
  assert.equal(wrote, false);
});

test("missing dest env marks that dest red and still runs the others", async () => {
  const env = {
    HOLDED_API_KEY: "holded-test",
    MAILCHIMP_API_KEY: "key-us21",
    MAILCHIMP_AUDIENCE_ID: "audience-test",
  };
  const store = memoryStore();
  const seen: DestName[] = [];
  const result = await landBooqableCustomer("cust-land-1", {
    store,
    fetchCustomer: async () => loadLandingFixture(),
    writers: [
      {
        name: "google",
        write: async (input) => {
          seen.push("google");
          return writeGoogleContact(input, env, async () => {
            throw new Error("google fetch must not run without env");
          });
        },
      },
      {
        name: "holded",
        write: async (input) => {
          seen.push("holded");
          return writeHoldedContact(input, env, async () =>
            jsonResponse(200, { id: "holded-1" }),
          );
        },
      },
      {
        name: "mailchimp",
        write: async (input) => {
          seen.push("mailchimp");
          return writeMailchimpMember(input, env, async () =>
            jsonResponse(200, { id: "mc-1" }),
          );
        },
      },
    ],
  });
  assert.equal(result.ok, true);
  if (!result.ok || result.ignored) throw new Error("expected landed statuses");
  assert.deepEqual(seen, ["google", "holded", "mailchimp"]);
  assert.equal(result.statuses.google.status, "red");
  assert.match(result.statuses.google.error ?? "", /GOOGLE_CONTACTS/);
  assert.equal(result.statuses.holded.status, "green");
  assert.equal(result.statuses.mailchimp.status, "green");
});

test("dest payloads omit absent passport fields and do not invent them", () => {
  const sparse = passport({
    phone: null,
    birthday: null,
    address: null,
  });
  const google = googleContactPerson(sparse);
  assert.equal("phoneNumbers" in google, false);
  assert.equal("addresses" in google, false);
  assert.equal("birthdays" in google, false);
  assert.ok(google.names);
  assert.ok(google.emailAddresses);

  const holded = holdedContactBody(sparse);
  assert.equal("phone" in holded, false);
  assert.equal("bill_address" in holded, false);
  assert.equal(holded.custom_id, "booqable:cust-land-1");

  const mailchimp = mailchimpMemberBody(sparse, true);
  const merge = mailchimp.merge_fields as Record<string, unknown>;
  assert.equal("PHONE" in merge, false);
  assert.equal("ADDRESS" in merge, false);
  assert.equal("BIRTHDAY" in merge, false);
  assert.equal(mailchimp.email_address, "landing@example.test");
});

test("Mailchimp 200 is green even when ADDRESS is omitted from the response", async () => {
  const result = await writeMailchimpMember(
    { passport: passport(), storedId: null },
    {
      MAILCHIMP_API_KEY: "key-us21",
      MAILCHIMP_AUDIENCE_ID: "audience-test",
    },
    async () => jsonResponse(200, { id: "mc-1", merge_fields: { FNAME: "Landing" } }),
  );
  assert.deepEqual(result, { ok: true, destId: "mc-1" });
  assert.equal(mailchimpDataCenter("key-us21"), "us21");
  assert.equal(
    mailchimpSubscriberHash("landing@example.test"),
    mailchimpSubscriberHash("Landing@Example.test"),
  );
});

test("Mailchimp 4xx is red with a next action; stored id is reused on update", async () => {
  const urls: string[] = [];
  const failed = await writeMailchimpMember(
    { passport: passport({ address: null }), storedId: null },
    {
      MAILCHIMP_API_KEY: "key-us21",
      MAILCHIMP_AUDIENCE_ID: "audience-test",
    },
    async (url) => {
      urls.push(String(url));
      return jsonResponse(400, { title: "Invalid Resource" });
    },
  );
  assert.equal(failed.ok, false);
  if (failed.ok) throw new Error("expected red");
  assert.match(failed.error, /Mailchimp/);
  assert.match(failed.error, /Save the customer in Booqable again/);

  const updated = await writeMailchimpMember(
    { passport: passport({ address: null }), storedId: "stored-hash" },
    {
      MAILCHIMP_API_KEY: "key-us21",
      MAILCHIMP_AUDIENCE_ID: "audience-test",
    },
    async (url) => {
      urls.push(String(url));
      return jsonResponse(200, { id: "stored-hash" });
    },
  );
  assert.equal(updated.ok, true);
  assert.match(urls.at(-1) ?? "", /members\/stored-hash$/);
});

test("Google and Holded update the stored id instead of creating a second contact", async () => {
  const googleCalls: string[] = [];
  const google = await writeGoogleContact(
    { passport: passport(), storedId: "people/c-stored" },
    {
      GOOGLE_CONTACTS_CLIENT_ID: "id",
      GOOGLE_CONTACTS_CLIENT_SECRET: "secret",
      GOOGLE_CONTACTS_REFRESH_TOKEN: "refresh",
    },
    async (url, init) => {
      googleCalls.push(`${init?.method ?? "GET"} ${String(url)}`);
      if (String(url).includes("oauth2.googleapis.com/token")) {
        return jsonResponse(200, { access_token: "token" });
      }
      if (String(url).includes("people/c-stored") && !String(url).includes("updateContact")) {
        return jsonResponse(200, { resourceName: "people/c-stored", etag: "etag-1" });
      }
      if (String(url).includes("updateContact")) {
        return jsonResponse(200, { resourceName: "people/c-stored" });
      }
      throw new Error(`unexpected Google URL ${String(url)}`);
    },
  );
  assert.deepEqual(google, { ok: true, destId: "people/c-stored" });
  assert.equal(
    googleCalls.some((call) => call.includes("people:createContact")),
    false,
  );

  const holdedCalls: string[] = [];
  const holded = await writeHoldedContact(
    { passport: passport(), storedId: "holded-stored" },
    { HOLDED_API_KEY: "holded-test" },
    async (url, init) => {
      holdedCalls.push(`${init?.method ?? "GET"} ${String(url)}`);
      return jsonResponse(200, { id: "holded-stored" });
    },
  );
  assert.deepEqual(holded, { ok: true, destId: "holded-stored" });
  assert.equal(
    holdedCalls.some((call) => call.startsWith("POST ")),
    false,
  );
  assert.equal(
    holdedCalls.some((call) => call.startsWith("PUT ") && call.includes("holded-stored")),
    true,
  );
});

function googleEnv() {
  return {
    GOOGLE_CONTACTS_CLIENT_ID: "id",
    GOOGLE_CONTACTS_CLIENT_SECRET: "secret",
    GOOGLE_CONTACTS_REFRESH_TOKEN: "refresh",
  };
}

test("Google token failures identify the recovery action and never call People API", async (t) => {
  const log = t.mock.method(console, "error", () => {});
  const cases = [
    { status: 400, error: "invalid_grant", expected: /expired or was revoked.*publishing status.*seven days/ },
    { status: 401, error: "invalid_client", expected: /client credentials.*client ID and client secret/ },
    { status: 400, error: "unauthorized_client", expected: /client credentials.*client ID and client secret/ },
    { status: 429, error: "rate_limit_exceeded", expected: /temporarily unavailable.*Try again later/ },
    { status: 503, error: "temporarily_unavailable", expected: /temporarily unavailable.*Try again later/ },
    { status: 400, error: "invalid_request", expected: /400, invalid_request.*check the Google OAuth configuration/ },
    { status: 400, error: "unexpected provider text", expected: /\(400\).*check the Google OAuth configuration/ },
  ];
  for (const scenario of cases) {
    const calls: string[] = [];
    const result = await writeGoogleContact(
      { passport: passport(), storedId: "people/c-stored" },
      googleEnv(),
      async (url) => {
        calls.push(String(url));
        return jsonResponse(scenario.status, {
          error: scenario.error,
          error_description: "untrusted provider detail",
          access_token: "must-not-be-logged",
        });
      },
    );
    assert.equal(result.ok, false);
    if (result.ok) throw new Error("expected token failure");
    assert.equal(result.destId, "people/c-stored");
    assert.match(result.error, scenario.expected);
    assert.match(result.error, /Save the customer in Booqable again/);
    assert.doesNotMatch(result.error, /untrusted provider detail|must-not-be-logged/);
    assert.deepEqual(calls, ["https://oauth2.googleapis.com/token"]);
  }
  assert.doesNotMatch(JSON.stringify(log.mock.calls), /untrusted provider detail|must-not-be-logged/);
});

test("Google automatically obtains a new access token for each contact write", async () => {
  let refreshes = 0;
  const fetchImpl: typeof fetch = async (url, init) => {
    const href = String(url);
    if (href === "https://oauth2.googleapis.com/token") {
      assert.equal(init?.method, "POST");
      assert.deepEqual(Object.fromEntries(new URLSearchParams(String(init?.body))), {
        client_id: "id",
        client_secret: "secret",
        refresh_token: "refresh",
        grant_type: "refresh_token",
      });
      refreshes += 1;
      return jsonResponse(200, { access_token: `token-${refreshes}` });
    }
    assert.equal(new Headers(init?.headers).get("Authorization"), `Bearer token-${refreshes}`);
    return jsonResponse(200, { resourceName: "people/c-stored", etag: "etag-1" });
  };
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = await writeGoogleContact(
      { passport: passport(), storedId: "people/c-stored" },
      googleEnv(),
      fetchImpl,
    );
    assert.deepEqual(result, { ok: true, destId: "people/c-stored" });
  }
  assert.equal(refreshes, 2);
});

test("first Google land creates when search finds nothing and updates a search hit", async () => {
  const created: string[] = [];
  const createdWhenEmpty = await writeGoogleContact(
    { passport: passport(), storedId: null },
    googleEnv(),
    async (url, init) => {
      const href = String(url);
      if (href.includes("oauth2.googleapis.com/token")) {
        return jsonResponse(200, { access_token: "token" });
      }
      if (href.includes("people:searchContacts")) {
        return jsonResponse(200, { results: [] });
      }
      if (href.includes("people:createContact")) {
        created.push(href);
        return jsonResponse(200, { resourceName: "people/c-new" });
      }
      throw new Error(`unexpected Google URL ${href} ${init?.method}`);
    },
  );
  assert.deepEqual(createdWhenEmpty, { ok: true, destId: "people/c-new" });
  assert.equal(created.length, 1);

  const createdWhenObject: string[] = [];
  const emptyObjectSearch = await writeGoogleContact(
    { passport: passport(), storedId: null },
    googleEnv(),
    async (url) => {
      const href = String(url);
      if (href.includes("oauth2.googleapis.com/token")) {
        return jsonResponse(200, { access_token: "token" });
      }
      if (href.includes("people:searchContacts")) {
        return jsonResponse(200, {});
      }
      if (href.includes("people:createContact")) {
        createdWhenObject.push(href);
        return jsonResponse(200, { resourceName: "people/c-empty" });
      }
      throw new Error(`unexpected Google URL ${href}`);
    },
  );
  assert.deepEqual(emptyObjectSearch, { ok: true, destId: "people/c-empty" });
  assert.equal(createdWhenObject.length, 1);

  const updatedCalls: string[] = [];
  const searchHit = await writeGoogleContact(
    { passport: passport(), storedId: null },
    googleEnv(),
    async (url, init) => {
      const href = String(url);
      updatedCalls.push(`${init?.method ?? "GET"} ${href}`);
      if (href.includes("oauth2.googleapis.com/token")) {
        return jsonResponse(200, { access_token: "token" });
      }
      if (href.includes("people:searchContacts")) {
        return jsonResponse(200, {
          results: [
            {
              person: {
                resourceName: "people/c-found",
                emailAddresses: [{ value: "landing@example.test" }],
              },
            },
          ],
        });
      }
      if (href.includes("people/c-found") && !href.includes("updateContact")) {
        return jsonResponse(200, { resourceName: "people/c-found", etag: "etag-1" });
      }
      if (href.includes("updateContact")) {
        return jsonResponse(200, { resourceName: "people/c-found" });
      }
      throw new Error(`unexpected Google URL ${href}`);
    },
  );
  assert.deepEqual(searchHit, { ok: true, destId: "people/c-found" });
  assert.equal(
    updatedCalls.some((call) => call.includes("people:createContact")),
    false,
  );
});

test("Google search failure is red and does not create", async () => {
  const created: string[] = [];
  const failed = await writeGoogleContact(
    { passport: passport(), storedId: null },
    googleEnv(),
    async (url) => {
      const href = String(url);
      if (href.includes("oauth2.googleapis.com/token")) {
        return jsonResponse(200, { access_token: "token" });
      }
      if (href.includes("people:searchContacts")) {
        return jsonResponse(500, { error: "unavailable" });
      }
      if (href.includes("people:createContact")) {
        created.push(href);
        return jsonResponse(200, { resourceName: "people/c-dup" });
      }
      throw new Error(`unexpected Google URL ${href}`);
    },
  );
  assert.equal(failed.ok, false);
  if (failed.ok) throw new Error("expected red");
  assert.match(failed.error, /Google Contacts/);
  assert.match(failed.error, /searchContacts failed/);
  assert.deepEqual(created, []);
});

test("first Holded land creates when list misses and updates a list hit", async () => {
  const methods: string[] = [];
  const created = await writeHoldedContact(
    { passport: passport(), storedId: null },
    { HOLDED_API_KEY: "holded-test" },
    async (url, init) => {
      const headers = new Headers(init?.headers);
      methods.push(`${init?.method ?? "GET"} ${String(url)}`);
      assert.equal(headers.get("authorization"), "Bearer holded-test");
      assert.match(String(url), /api\/v2\/contacts/);
      if ((init?.method ?? "GET") === "GET") {
        return jsonResponse(200, { items: [] });
      }
      return jsonResponse(201, { id: 7788 });
    },
  );
  assert.deepEqual(created, { ok: true, destId: "7788" });
  assert.equal(methods.some((call) => call.includes("email=landing")), true);
  assert.equal(methods.some((call) => call.startsWith("POST ")), true);

  const hitMethods: string[] = [];
  const hit = await writeHoldedContact(
    { passport: passport(), storedId: null },
    { HOLDED_API_KEY: "holded-test" },
    async (url, init) => {
      hitMethods.push(`${init?.method ?? "GET"} ${String(url)}`);
      if ((init?.method ?? "GET") === "GET") {
        return jsonResponse(200, [
          { id: 99, email: "landing@example.test" },
        ]);
      }
      return jsonResponse(200, { id: 99 });
    },
  );
  assert.deepEqual(hit, { ok: true, destId: "99" });
  assert.equal(hitMethods.some((call) => call.startsWith("POST ")), false);
  assert.equal(
    hitMethods.some((call) => call.startsWith("PUT ") && call.includes("/99")),
    true,
  );
});

test("digit-normalize phone match treats formatted numbers as equal", () => {
  assert.equal(phonesMatch("+34 000 000 000", "34000000000"), true);
  assert.equal(phonesMatch("+34000000000", "34 000 000 000"), true);
  assert.equal(phonesMatch("+34000000000", "+34111111111"), false);
  assert.equal(phonesMatch("", "+34000000000"), false);
});

test("Google finds by phone after email miss and when there is no email", async () => {
  const phoneHit = await writeGoogleContact(
    { passport: passport(), storedId: null },
    googleEnv(),
    async (url, init) => {
      const href = String(url);
      if (href.includes("oauth2.googleapis.com/token")) {
        return jsonResponse(200, { access_token: "token" });
      }
      if (href.includes("people:searchContacts")) {
        if (href.includes(encodeURIComponent("landing@example.test"))) {
          return jsonResponse(200, { results: [] });
        }
        assert.match(href, /34000000000|\+34000000000|%2B34000000000/);
        return jsonResponse(200, {
          results: [
            {
              person: {
                resourceName: "people/c-phone",
                phoneNumbers: [{ value: "34 000 000 000" }],
              },
            },
          ],
        });
      }
      if (href.includes("people/c-phone") && !href.includes("updateContact")) {
        return jsonResponse(200, { resourceName: "people/c-phone", etag: "etag-p" });
      }
      if (href.includes("updateContact")) {
        return jsonResponse(200, { resourceName: "people/c-phone" });
      }
      throw new Error(`unexpected Google URL ${href} ${init?.method}`);
    },
  );
  assert.deepEqual(phoneHit, { ok: true, destId: "people/c-phone" });

  const canonical = await writeGoogleContact(
    { passport: passport({ email: null }), storedId: null },
    googleEnv(),
    async (url) => {
      const href = String(url);
      if (href.includes("oauth2.googleapis.com/token")) {
        return jsonResponse(200, { access_token: "token" });
      }
      if (href.includes("people:searchContacts")) {
        return jsonResponse(200, {
          results: [
            {
              person: {
                resourceName: "people/c-canonical",
                phoneNumbers: [{ canonicalForm: "+34000000000" }],
              },
            },
          ],
        });
      }
      if (href.includes("people/c-canonical") && !href.includes("updateContact")) {
        return jsonResponse(200, {
          resourceName: "people/c-canonical",
          etag: "etag-c",
        });
      }
      if (href.includes("updateContact")) {
        return jsonResponse(200, { resourceName: "people/c-canonical" });
      }
      throw new Error(`unexpected Google URL ${href}`);
    },
  );
  assert.deepEqual(canonical, { ok: true, destId: "people/c-canonical" });

  const created: string[] = [];
  const noEmail = await writeGoogleContact(
    { passport: passport({ email: null }), storedId: null },
    googleEnv(),
    async (url) => {
      const href = String(url);
      if (href.includes("oauth2.googleapis.com/token")) {
        return jsonResponse(200, { access_token: "token" });
      }
      if (href.includes("people:searchContacts")) {
        assert.equal(href.includes("landing@example.test"), false);
        return jsonResponse(200, {
          results: [
            {
              person: {
                resourceName: "people/c-phone-only",
                phoneNumbers: [{ value: "+34 000 000 000" }],
              },
            },
          ],
        });
      }
      if (href.includes("people/c-phone-only") && !href.includes("updateContact")) {
        return jsonResponse(200, {
          resourceName: "people/c-phone-only",
          etag: "etag-p2",
        });
      }
      if (href.includes("updateContact")) {
        return jsonResponse(200, { resourceName: "people/c-phone-only" });
      }
      if (href.includes("people:createContact")) {
        created.push(href);
        return jsonResponse(200, { resourceName: "people/c-dup" });
      }
      throw new Error(`unexpected Google URL ${href}`);
    },
  );
  assert.deepEqual(noEmail, { ok: true, destId: "people/c-phone-only" });
  assert.deepEqual(created, []);
});

test("Google phone search failure after email miss is red and does not create", async () => {
  const created: string[] = [];
  const afterEmail = await writeGoogleContact(
    { passport: passport(), storedId: null },
    googleEnv(),
    async (url) => {
      const href = String(url);
      if (href.includes("oauth2.googleapis.com/token")) {
        return jsonResponse(200, { access_token: "token" });
      }
      if (href.includes("people:searchContacts")) {
        if (href.includes(encodeURIComponent("landing@example.test"))) {
          return jsonResponse(200, { results: [] });
        }
        return jsonResponse(500, { error: "unavailable" });
      }
      if (href.includes("people:createContact")) {
        created.push(href);
        return jsonResponse(200, { resourceName: "people/c-dup" });
      }
      throw new Error(`unexpected Google URL ${href}`);
    },
  );
  assert.equal(afterEmail.ok, false);
  if (afterEmail.ok) throw new Error("expected red");
  assert.match(afterEmail.error, /searchContacts failed/);
  assert.deepEqual(created, []);

  const noEmailCreated: string[] = [];
  const noEmail = await writeGoogleContact(
    { passport: passport({ email: null }), storedId: null },
    googleEnv(),
    async (url) => {
      const href = String(url);
      if (href.includes("oauth2.googleapis.com/token")) {
        return jsonResponse(200, { access_token: "token" });
      }
      if (href.includes("people:searchContacts")) {
        return jsonResponse(500, { error: "unavailable" });
      }
      if (href.includes("people:createContact")) {
        noEmailCreated.push(href);
        return jsonResponse(200, { resourceName: "people/c-dup" });
      }
      throw new Error(`unexpected Google URL ${href}`);
    },
  );
  assert.equal(noEmail.ok, false);
  if (noEmail.ok) throw new Error("expected red");
  assert.match(noEmail.error, /searchContacts failed/);
  assert.deepEqual(noEmailCreated, []);
});

test("Holded finds by phone after email miss and when there is no email", async () => {
  const afterEmailMiss = await writeHoldedContact(
    { passport: passport(), storedId: null },
    { HOLDED_API_KEY: "holded-test" },
    async (url, init) => {
      const href = String(url);
      if ((init?.method ?? "GET") === "GET") {
        if (href.includes("email=")) {
          return jsonResponse(200, { items: [] });
        }
        assert.match(href, /phone=|mobile=/);
        return jsonResponse(200, [
          { id: "holded-phone", phone: "34 000 000 000" },
        ]);
      }
      assert.equal((init?.method ?? "GET") === "POST", false);
      return jsonResponse(200, { id: "holded-phone" });
    },
  );
  assert.deepEqual(afterEmailMiss, { ok: true, destId: "holded-phone" });

  const created: string[] = [];
  const noEmail = await writeHoldedContact(
    { passport: passport({ email: null }), storedId: null },
    { HOLDED_API_KEY: "holded-test" },
    async (url, init) => {
      const href = String(url);
      if ((init?.method ?? "GET") === "GET") {
        assert.equal(href.includes("email="), false);
        return jsonResponse(200, {
          items: [{ id: 55, mobile: "+34000000000" }],
        });
      }
      if ((init?.method ?? "GET") === "POST") {
        created.push(href);
      }
      return jsonResponse(200, { id: 55 });
    },
  );
  assert.deepEqual(noEmail, { ok: true, destId: "55" });
  assert.deepEqual(created, []);
});

test("Holded phone list failure after email miss is red and does not create", async () => {
  const methods: string[] = [];
  const afterEmail = await writeHoldedContact(
    { passport: passport(), storedId: null },
    { HOLDED_API_KEY: "holded-test" },
    async (url, init) => {
      methods.push(`${init?.method ?? "GET"} ${String(url)}`);
      if ((init?.method ?? "GET") === "GET" && String(url).includes("email=")) {
        return jsonResponse(200, { items: [] });
      }
      return jsonResponse(503, { error: "down" });
    },
  );
  assert.equal(afterEmail.ok, false);
  if (afterEmail.ok) throw new Error("expected red");
  assert.match(afterEmail.error, /list contacts failed/);
  assert.equal(methods.some((call) => call.startsWith("POST ")), false);

  const noEmailMethods: string[] = [];
  const noEmail = await writeHoldedContact(
    { passport: passport({ email: null }), storedId: null },
    { HOLDED_API_KEY: "holded-test" },
    async (url, init) => {
      noEmailMethods.push(`${init?.method ?? "GET"} ${String(url)}`);
      return jsonResponse(503, { error: "down" });
    },
  );
  assert.equal(noEmail.ok, false);
  if (noEmail.ok) throw new Error("expected red");
  assert.match(noEmail.error, /list contacts failed/);
  assert.equal(noEmailMethods.some((call) => call.startsWith("POST ")), false);
});

test("Holded phone match without an id is red and does not create", async () => {
  const methods: string[] = [];
  const result = await writeHoldedContact(
    { passport: passport({ email: null }), storedId: null },
    { HOLDED_API_KEY: "holded-test" },
    async (url, init) => {
      methods.push(`${init?.method ?? "GET"} ${String(url)}`);
      if ((init?.method ?? "GET") === "GET") {
        return jsonResponse(200, [{ phone: 34000000000 }]);
      }
      return jsonResponse(201, { id: "should-not-create" });
    },
  );
  assert.equal(result.ok, false);
  if (result.ok) throw new Error("expected red");
  assert.match(result.error, /missing id/);
  assert.equal(methods.some((call) => call.startsWith("POST ")), false);
});

test("Mailchimp stays email-keyed when the passport has only a phone", async () => {
  const result = await writeMailchimpMember(
    { passport: passport({ email: null }), storedId: null },
    {
      MAILCHIMP_API_KEY: "key-us21",
      MAILCHIMP_AUDIENCE_ID: "audience-test",
    },
    async () => {
      throw new Error("Mailchimp must not run without email");
    },
  );
  assert.equal(result.ok, false);
  if (result.ok) throw new Error("expected red");
  assert.match(result.error, /an email is required/);
});

test("Holded list failure is red and does not create", async () => {
  const methods: string[] = [];
  const failed = await writeHoldedContact(
    { passport: passport(), storedId: null },
    { HOLDED_API_KEY: "holded-test" },
    async (url, init) => {
      methods.push(`${init?.method ?? "GET"} ${String(url)}`);
      return jsonResponse(503, { error: "down" });
    },
  );
  assert.equal(failed.ok, false);
  if (failed.ok) throw new Error("expected red");
  assert.match(failed.error, /Holded/);
  assert.match(failed.error, /list contacts failed/);
  assert.equal(methods.some((call) => call.startsWith("POST ")), false);
});

test("two lands on one unseeded store reuse first saveStatuses dest ids", async () => {
  const store = memoryStore();
  const seen: Array<{ name: DestName; storedId: string | null }> = [];
  const writers = writersFromResults(
    {
      google: { ok: true, destId: "people/c-1" },
      holded: { ok: true, destId: "holded-1" },
      mailchimp: { ok: true, destId: "mc-1" },
    },
    seen,
  );
  const first = await landBooqableCustomer("cust-land-1", {
    store,
    fetchCustomer: async () => loadLandingFixture(),
    writers,
  });
  const second = await landBooqableCustomer("cust-land-1", {
    store,
    fetchCustomer: async () => loadLandingFixture(),
    writers,
  });
  assert.equal(first.ok && !first.ignored, true);
  assert.equal(second.ok && !second.ignored, true);
  if (!first.ok || first.ignored) throw new Error("expected first land");
  assert.deepEqual(seen.slice(0, 3).map((row) => row.storedId), [null, null, null]);
  assert.deepEqual(seen.slice(3).map((row) => row.storedId), [
    first.statuses.google.id,
    first.statuses.holded.id,
    first.statuses.mailchimp.id,
  ]);
  assert.deepEqual(store.saved[0], first.statuses);
});

test("empty Google person is red and a writer throw still saves other dests", async () => {
  const empty = await writeGoogleContact({
    passport: passport({
      name: null,
      email: null,
      phone: null,
      birthday: null,
      address: null,
    }),
    storedId: null,
  });
  assert.equal(empty.ok, false);
  if (empty.ok) throw new Error("expected red");
  assert.match(empty.error, /no writable fields/);

  const store = memoryStore();
  const result = await landBooqableCustomer("cust-land-1", {
    store,
    fetchCustomer: async () => loadLandingFixture(),
    writers: [
      {
        name: "google",
        async write() {
          throw new Error("boom");
        },
      },
      {
        name: "holded",
        async write() {
          return { ok: true, destId: "holded-1" };
        },
      },
      {
        name: "mailchimp",
        async write() {
          return { ok: true, destId: "mc-1" };
        },
      },
    ],
  });
  assert.equal(result.ok, true);
  if (!result.ok || result.ignored) throw new Error("expected landed statuses");
  assert.equal(result.statuses.google.status, "red");
  assert.match(result.statuses.google.error ?? "", /write threw/);
  assert.equal(result.statuses.holded.status, "green");
  assert.equal(result.statuses.mailchimp.status, "green");
  assert.equal(store.saved.length, 1);
  assert.equal(store.saved[0]?.holded.id, "holded-1");
});

test("Holded numeric id is persisted as a string", async () => {
  const result = await writeHoldedContact(
    { passport: passport(), storedId: null },
    { HOLDED_API_KEY: "holded-test" },
    async (_url, init) => {
      if ((init?.method ?? "GET") === "GET") return jsonResponse(200, []);
      return jsonResponse(200, { id: 12345 });
    },
  );
  assert.deepEqual(result, { ok: true, destId: "12345" });
});

test("Mailchimp stored-id 404 recreates via email hash", async () => {
  const urls: string[] = [];
  const emailHash = mailchimpSubscriberHash("landing@example.test");
  const result = await writeMailchimpMember(
    { passport: passport({ address: null }), storedId: "old-hash" },
    {
      MAILCHIMP_API_KEY: "key-us21",
      MAILCHIMP_AUDIENCE_ID: "audience-test",
    },
    async (url) => {
      urls.push(String(url));
      if (String(url).endsWith("/old-hash")) {
        return jsonResponse(404, { title: "Resource Not Found" });
      }
      return jsonResponse(200, { id: emailHash });
    },
  );
  assert.deepEqual(result, { ok: true, destId: emailHash });
  assert.match(urls[0] ?? "", /members\/old-hash$/);
  assert.match(urls.at(-1) ?? "", new RegExp(`members/${emailHash}$`));
});

test("address identifier address parses; whitespace and ISO birthday do not land", () => {
  const doc = loadLandingFixture() as {
    data: { attributes: { properties: Record<string, unknown> } };
    included: Array<{ attributes: Record<string, unknown> }>;
  };
  delete doc.included[0].attributes.property_type;
  doc.included[0].attributes.identifier = "address";
  const byIdentifier = parseLandingCustomer(doc);
  assert.equal(byIdentifier.address?.street, "Carrer de Mallorca 1");

  const whitespace = loadLandingFixture() as {
    data: { attributes: { properties: Record<string, unknown>; name?: unknown } };
  };
  whitespace.data.attributes.properties.birthday_date = "   ";
  whitespace.data.attributes.name = "   ";
  const parsedWhitespace = parseLandingCustomer(whitespace);
  assert.equal(parsedWhitespace.birthday, null);
  assert.equal(parsedWhitespace.name, null);

  const iso = loadLandingFixture() as {
    data: { attributes: { properties: Record<string, unknown> } };
  };
  iso.data.attributes.properties.birthday_date = "1990-05-17T00:00:00Z";
  assert.equal(parseLandingCustomer(iso).birthday, null);
});

function mailchimpEnv() {
  return {
    MAILCHIMP_API_KEY: "key-us21",
    MAILCHIMP_AUDIENCE_ID: "audience-test",
  };
}

function orderDocument(email: string | null, hasCustomer = true): unknown {
  if (!hasCustomer) {
    return {
      data: {
        id: "order-1",
        type: "orders",
        relationships: { customer: { data: null } },
      },
      included: [],
    };
  }
  return {
    data: {
      id: "order-1",
      type: "orders",
      relationships: {
        customer: { data: { id: "cust-1", type: "customers" } },
      },
    },
    included: [
      {
        id: "cust-1",
        type: "customers",
        attributes: { email },
      },
    ],
  };
}

type MailchimpCall = { method: string; url: string; body: unknown };

function reviewRequestFetch(plan: {
  tagSearch?: { status: number; body: unknown };
  createSegment?: { status: number; body: unknown };
  member?: { status: number; body: unknown };
  addTags?: { status: number; body: unknown };
}): { calls: MailchimpCall[]; fetchImpl: typeof fetch } {
  const calls: MailchimpCall[] = [];
  const fetchImpl: typeof fetch = async (url, init) => {
    const href = String(url);
    const method = (init?.method ?? "GET").toUpperCase();
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    calls.push({ method, url: href, body });
    const headers = new Headers(init?.headers);
    assert.equal(
      headers.get("authorization"),
      `Basic ${Buffer.from("anystring:key-us21").toString("base64")}`,
    );

    if (href.includes("/tag-search")) {
      const res = plan.tagSearch ?? { status: 200, body: { tags: [] } };
      return jsonResponse(res.status, res.body);
    }
    if (href.includes("/segments") && method === "POST") {
      const res = plan.createSegment ?? {
        status: 200,
        body: { id: 1, name: REVIEW_REQUEST_TAG },
      };
      return jsonResponse(res.status, res.body);
    }
    if (href.endsWith("/tags") && method === "POST") {
      const res = plan.addTags ?? { status: 204, body: null };
      if (res.status === 204) {
        return new Response(null, { status: 204 });
      }
      return jsonResponse(res.status, res.body);
    }
    if (href.includes("/members/") && method === "GET") {
      const res = plan.member ?? { status: 200, body: { id: "mc-1", tags: [] } };
      return jsonResponse(res.status, res.body);
    }
    throw new Error(`unexpected Mailchimp ${method} ${href}`);
  };
  return { calls, fetchImpl };
}

test("review-request find-or-create, GET member, add tag; never upserts", async () => {
  const email = "landing@example.test";
  const hash = mailchimpSubscriberHash(email);
  const created = reviewRequestFetch({});
  await tagMailchimpReviewRequest(email, mailchimpEnv(), created.fetchImpl);
  assert.equal(
    created.calls.some((call) => call.method === "PUT"),
    false,
  );
  assert.equal(
    created.calls.some((call) => call.url.includes("/tag-search")),
    true,
  );
  assert.equal(
    created.calls.some(
      (call) => call.method === "POST" && call.url.includes("/segments"),
    ),
    true,
  );
  assert.equal(
    created.calls.some(
      (call) => call.method === "GET" && call.url.endsWith(`/members/${hash}`),
    ),
    true,
  );
  const add = created.calls.find(
    (call) => call.method === "POST" && call.url.endsWith("/tags"),
  );
  assert.ok(add);
  assert.deepEqual(add?.body, {
    tags: [{ name: REVIEW_REQUEST_TAG, status: "active" }],
  });

  const existingTag = reviewRequestFetch({
    tagSearch: {
      status: 200,
      body: { tags: [{ id: 9, name: REVIEW_REQUEST_TAG }] },
    },
  });
  await tagMailchimpReviewRequest(email, mailchimpEnv(), existingTag.fetchImpl);
  assert.equal(
    existingTag.calls.some((call) => call.url.includes("/segments")),
    false,
  );
  assert.equal(
    existingTag.calls.some((call) => call.url.endsWith("/tags")),
    true,
  );

  const containsOnly = reviewRequestFetch({
    tagSearch: {
      status: 200,
      body: { tags: [{ id: 8, name: "pre-review-request" }] },
    },
  });
  await tagMailchimpReviewRequest(email, mailchimpEnv(), containsOnly.fetchImpl);
  assert.equal(
    containsOnly.calls.some(
      (call) => call.method === "POST" && call.url.includes("/segments"),
    ),
    true,
  );

  const tagSearchFail = reviewRequestFetch({
    tagSearch: { status: 503, body: { title: "Unavailable" } },
  });
  await tagMailchimpReviewRequest(email, mailchimpEnv(), tagSearchFail.fetchImpl);
  assert.equal(
    tagSearchFail.calls.some((call) => call.url.includes("/members/")),
    false,
  );
  assert.equal(
    tagSearchFail.calls.some((call) => call.method === "PUT"),
    false,
  );
});

test("review-request skips missing subscriber and already-tagged members", async () => {
  const email = "landing@example.test";
  const missing = reviewRequestFetch({
    tagSearch: {
      status: 200,
      body: { tags: [{ id: 9, name: REVIEW_REQUEST_TAG }] },
    },
    member: { status: 404, body: { title: "Resource Not Found" } },
  });
  const errors: unknown[][] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    errors.push(args);
  };
  try {
    await tagMailchimpReviewRequest(email, mailchimpEnv(), missing.fetchImpl);
  } finally {
    console.error = originalError;
  }
  assert.equal(
    missing.calls.some((call) => call.method === "PUT"),
    false,
  );
  assert.equal(
    missing.calls.some((call) => call.url.endsWith("/tags")),
    false,
  );
  assert.equal(
    errors.some((args) => String(args[0]).includes("[review-request/mailchimp]")),
    true,
  );

  const already = reviewRequestFetch({
    tagSearch: {
      status: 200,
      body: { tags: [{ id: 9, name: REVIEW_REQUEST_TAG }] },
    },
    member: {
      status: 200,
      body: { id: "mc-1", tags: [{ id: 9, name: REVIEW_REQUEST_TAG }] },
    },
  });
  const alreadyLogs: unknown[][] = [];
  console.error = (...args: unknown[]) => {
    alreadyLogs.push(args);
  };
  try {
    await tagMailchimpReviewRequest(email, mailchimpEnv(), already.fetchImpl);
  } finally {
    console.error = originalError;
  }
  assert.equal(
    already.calls.some((call) => call.url.endsWith("/tags")),
    false,
  );
  assert.equal(
    alreadyLogs.some(
      (args) =>
        String(args[0]).includes("[review-request/mailchimp]") &&
        args.some((arg) => String(arg).includes("already tagged")),
    ),
    true,
  );
});

test("review-request order tagger GETs Booqable email and does not invent it", async () => {
  const email = "rider@example.test";
  const hash = mailchimpSubscriberHash(email);
  const happy = reviewRequestFetch({
    tagSearch: {
      status: 200,
      body: { tags: [{ id: 9, name: REVIEW_REQUEST_TAG }] },
    },
  });
  let fetchedId: string | null = null;
  await tagReviewRequestForOrder("order-1", {
    env: mailchimpEnv(),
    fetchOrder: async (id) => {
      fetchedId = id;
      return orderDocument(email);
    },
    fetchImpl: happy.fetchImpl,
  });
  assert.equal(fetchedId, "order-1");
  assert.equal(
    happy.calls.some(
      (call) => call.method === "GET" && call.url.endsWith(`/members/${hash}`),
    ),
    true,
  );
  assert.equal(
    happy.calls.some((call) => call.method === "POST" && call.url.endsWith("/tags")),
    true,
  );

  const noMailchimp: MailchimpCall[] = [];
  const blankErrors: unknown[][] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    blankErrors.push(args);
  };
  try {
    await tagReviewRequestForOrder("order-blank", {
      env: mailchimpEnv(),
      fetchOrder: async () => orderDocument("   "),
      fetchImpl: async (url, init) => {
        noMailchimp.push({
          method: (init?.method ?? "GET").toUpperCase(),
          url: String(url),
          body: null,
        });
        throw new Error("Mailchimp must not run without email");
      },
    });
    await tagReviewRequestForOrder("order-none", {
      env: mailchimpEnv(),
      fetchOrder: async () => orderDocument(null, false),
      fetchImpl: async () => {
        throw new Error("Mailchimp must not run without customer");
      },
    });
    await tagReviewRequestForOrder("order-get-fail", {
      env: mailchimpEnv(),
      fetchOrder: async () => {
        throw new Error("Booqable GET failed");
      },
      fetchImpl: async () => {
        throw new Error("Mailchimp must not run after GET fail");
      },
    });
  } finally {
    console.error = originalError;
  }
  assert.deepEqual(noMailchimp, []);
  assert.equal(
    blankErrors.some((args) => String(args[0]).includes("[review-request/mailchimp]")),
    true,
  );

  const missingEnvCalls: MailchimpCall[] = [];
  console.error = () => {};
  try {
    await tagReviewRequestForOrder("order-env", {
      env: {},
      fetchOrder: async () => orderDocument(email),
      fetchImpl: async (url, init) => {
        missingEnvCalls.push({
          method: (init?.method ?? "GET").toUpperCase(),
          url: String(url),
          body: null,
        });
        return jsonResponse(200, {});
      },
    });
  } finally {
    console.error = originalError;
  }
  assert.deepEqual(missingEnvCalls, []);
});

test("review-request tagger stays off landing upsert and workshop apply", () => {
  const mailchimp = readSrc("lib/customer-landing/mailchimp.ts");
  const tagger = readSrc("lib/customer-landing/tag-review-request.ts");
  const land = readSrc("lib/customer-landing/land-customer.ts");
  assert.match(mailchimp, /\[review-request\/mailchimp\]/);
  assert.match(mailchimp, /tag-search/);
  assert.match(mailchimp, /status: "active"/);
  assert.match(tagger, /fetchSourceOrderDocument/);
  assert.doesNotMatch(tagger, /writeMailchimpMember/);
  assert.doesNotMatch(tagger, /landBooqableCustomer/);
  assert.doesNotMatch(tagger, /parseSourceOrderSnapshot/);
  assert.doesNotMatch(tagger, /reconcileBooqableOrder/);
  assert.doesNotMatch(land, /tagMailchimpReviewRequest|tagReviewRequestForOrder/);
});

test("audience id is read from env and not hardcoded", () => {
  const mailchimp = readSrc("lib/customer-landing/mailchimp.ts");
  const land = readSrc("lib/customer-landing/land-customer.ts");
  assert.doesNotMatch(mailchimp, /74fcbaad78/);
  assert.doesNotMatch(land, /74fcbaad78/);
  assert.match(mailchimp, /MAILCHIMP_AUDIENCE_ID/);
});

test("only src/lib/booqable calls Booqable and landing stays off client surfaces", () => {
  const fetchSource = readSrc("lib/booqable/fetch-source-snapshot.ts");
  assert.match(fetchSource, /\/api\/4\/customers\//);
  assert.match(fetchSource, /include=properties/);
  assert.doesNotMatch(fetchSource, /fields\[customers\]/);

  for (const file of collectTsFiles(srcRoot)) {
    const relative = file.slice(srcRoot.length + 1);
    const source = readFileSync(file, "utf8");
    if (relative !== "lib/booqable/fetch-source-snapshot.ts") {
      assert.doesNotMatch(
        source,
        /\/api\/4\/customers\//,
        `${relative} must not call Booqable`,
      );
    }
    if (
      relative.startsWith("app/") &&
      !relative.startsWith("app/api/webhooks/booqable/") &&
      !relative.startsWith("app/customers/")
    ) {
      assert.doesNotMatch(
        source,
        /from\s+["']@\/src\/lib\/customer-landing/,
        `${relative} must not import customer-landing`,
      );
    }
  }

  const nav = readSrc("ui/layouts/nav-config.ts");
  assert.match(nav, /label: "Customers"/);
  assert.match(nav, /href: "\/customers"/);
});
