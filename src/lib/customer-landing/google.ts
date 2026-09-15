import type { CustomerPassport, PassportAddress } from "./types.ts";
import type { DestWriteResult, EnvMap } from "./types.ts";
import {
  destNextAction,
  isRecord,
  normalizePhoneDigits,
  omitEmpty,
  phonesMatch,
  presentString,
} from "./dest-error.ts";

const LOG_PREFIX = "[customer-landing/google]";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const PEOPLE_URL = "https://people.googleapis.com/v1";
const PERSON_FIELDS = "names,emailAddresses,phoneNumbers,addresses,birthdays";

type FetchLike = typeof fetch;

function googleAddress(
  address: PassportAddress | null,
): Record<string, string> | undefined {
  if (!address) return undefined;
  const body = omitEmpty({
    streetAddress: presentString(address.street),
    city: presentString(address.city),
    region: presentString(address.region),
    postalCode: presentString(address.zip),
    country: presentString(address.country),
  });
  return Object.keys(body).length > 0 ? (body as Record<string, string>) : undefined;
}

function googleBirthday(birthday: string | null): Record<string, unknown> | undefined {
  if (!birthday) return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthday);
  if (!match) return undefined;
  return {
    date: {
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3]),
    },
  };
}

export function googleContactPerson(passport: CustomerPassport): Record<string, unknown> {
  const person: Record<string, unknown> = {};
  const name = presentString(passport.name);
  if (name) person.names = [{ unstructuredName: name }];
  const email = presentString(passport.email);
  if (email) person.emailAddresses = [{ value: email }];
  const phone = presentString(passport.phone);
  if (phone) person.phoneNumbers = [{ value: phone }];
  const address = googleAddress(passport.address);
  if (address) person.addresses = [address];
  const birthday = googleBirthday(passport.birthday);
  if (birthday) person.birthdays = [birthday];
  return person;
}

function updatePersonFields(person: Record<string, unknown>): string {
  return Object.keys(person).join(",");
}

function googleEnv(env: EnvMap): { clientId: string; clientSecret: string; refreshToken: string } | { error: string } {
  const clientId = presentString(env.GOOGLE_CONTACTS_CLIENT_ID);
  const clientSecret = presentString(env.GOOGLE_CONTACTS_CLIENT_SECRET);
  const refreshToken = presentString(env.GOOGLE_CONTACTS_REFRESH_TOKEN);
  if (!clientId || !clientSecret || !refreshToken) {
    return {
      error: destNextAction(
        "Google Contacts",
        "GOOGLE_CONTACTS_CLIENT_ID, GOOGLE_CONTACTS_CLIENT_SECRET, or GOOGLE_CONTACTS_REFRESH_TOKEN is unset.",
      ),
    };
  }
  return { clientId, clientSecret, refreshToken };
}

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (text.trim() === "") return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text };
  }
}

async function accessToken(
  creds: { clientId: string; clientSecret: string; refreshToken: string },
  fetchImpl: FetchLike,
): Promise<{ token: string } | { error: string }> {
  const body = new URLSearchParams({
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    refresh_token: creds.refreshToken,
    grant_type: "refresh_token",
  });
  let res: Response;
  try {
    res = await fetchImpl(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
  } catch (error) {
    console.error(LOG_PREFIX, error);
    return {
      error: destNextAction("Google Contacts", "Could not refresh the access token."),
    };
  }
  const payload = await readJson(res);
  if (!res.ok) {
    const oauthError =
      isRecord(payload) &&
      typeof payload.error === "string" &&
      /^[a-z_]{1,64}$/.test(payload.error)
        ? payload.error
        : null;
    // Log the error code, never an OAuth response that could contain credentials.
    console.error(LOG_PREFIX, "token refresh failed", res.status, oauthError);
    let detail = `Could not refresh the access token (${res.status}${oauthError ? `, ${oauthError}` : ""}). Ask an administrator to check the Google OAuth configuration.`;
    if (res.status === 429 || res.status >= 500) {
      detail = `Google's token service is temporarily unavailable (${res.status}). Try again later.`;
    } else if (oauthError === "invalid_grant") {
      detail = "Google authorization expired or was revoked (invalid_grant). Ask an administrator to check the OAuth app's publishing status and reconnect the Google account. Testing authorizations expire after seven days.";
    } else if (oauthError === "invalid_client" || oauthError === "unauthorized_client") {
      detail = `Google rejected the app's OAuth client credentials (${oauthError}). Ask an administrator to check the configured client ID and client secret.`;
    }
    return {
      error: destNextAction("Google Contacts", detail),
    };
  }
  const token =
    isRecord(payload) && typeof payload.access_token === "string"
      ? payload.access_token
      : null;
  if (!token) {
    return {
      error: destNextAction("Google Contacts", "token response did not include access_token."),
    };
  }
  return { token };
}

async function peopleRequest(
  url: string,
  token: string,
  fetchImpl: FetchLike,
  init: RequestInit = {},
): Promise<{ res: Response; payload: unknown }> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    ...(init.headers as Record<string, string> | undefined),
  };
  if (init.body != null) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetchImpl(url, {
    ...init,
    headers,
  });
  return { res, payload: await readJson(res) };
}

function searchContactResults(payload: unknown): unknown[] | null {
  if (payload == null) return [];
  if (!isRecord(payload)) return null;
  if (payload.results == null) return [];
  return Array.isArray(payload.results) ? payload.results : null;
}

function personResourceName(payload: unknown): string | null {
  if (!isRecord(payload)) return null;
  return typeof payload.resourceName === "string" && payload.resourceName.trim() !== ""
    ? payload.resourceName
    : null;
}

function personEtag(payload: unknown): string | null {
  if (!isRecord(payload)) return null;
  return typeof payload.etag === "string" && payload.etag.trim() !== ""
    ? payload.etag
    : null;
}

async function createContact(
  token: string,
  person: Record<string, unknown>,
  fetchImpl: FetchLike,
): Promise<DestWriteResult> {
  try {
    const { res, payload } = await peopleRequest(
      `${PEOPLE_URL}/people:createContact`,
      token,
      fetchImpl,
      { method: "POST", body: JSON.stringify(person) },
    );
    const destId = personResourceName(payload);
    if (res.ok && destId) return { ok: true, destId };
    console.error(LOG_PREFIX, res.status, payload);
    return {
      ok: false,
      error: destNextAction(
        "Google Contacts",
        `createContact failed (${res.status}).`,
      ),
    };
  } catch (error) {
    console.error(LOG_PREFIX, error);
    return {
      ok: false,
      error: destNextAction("Google Contacts", "createContact request failed."),
    };
  }
}

async function updateContact(
  token: string,
  resourceName: string,
  person: Record<string, unknown>,
  fetchImpl: FetchLike,
): Promise<DestWriteResult> {
  try {
    const got = await peopleRequest(
      `${PEOPLE_URL}/${resourceName}?personFields=metadata,${PERSON_FIELDS}`,
      token,
      fetchImpl,
    );
    if (got.res.status === 404) {
      return createContact(token, person, fetchImpl);
    }
    if (!got.res.ok) {
      console.error(LOG_PREFIX, got.res.status, got.payload);
      return {
        ok: false,
        destId: resourceName,
        error: destNextAction(
          "Google Contacts",
          `could not read stored contact (${got.res.status}).`,
        ),
      };
    }
    const etag = personEtag(got.payload);
    if (!etag) {
      return {
        ok: false,
        destId: resourceName,
        error: destNextAction("Google Contacts", "stored contact is missing etag."),
      };
    }
    const fields = updatePersonFields(person);
    if (fields === "") {
      return {
        ok: false,
        destId: resourceName,
        error: destNextAction(
          "Google Contacts",
          "the passport has no writable fields.",
        ),
      };
    }
    const patched = await peopleRequest(
      `${PEOPLE_URL}/${resourceName}:updateContact?updatePersonFields=${encodeURIComponent(fields)}`,
      token,
      fetchImpl,
      {
        method: "PATCH",
        body: JSON.stringify({ ...person, etag, resourceName }),
      },
    );
    const destId = personResourceName(patched.payload) ?? resourceName;
    if (patched.res.ok) return { ok: true, destId };
    console.error(LOG_PREFIX, patched.res.status, patched.payload);
    return {
      ok: false,
      destId: resourceName,
      error: destNextAction(
        "Google Contacts",
        `updateContact failed (${patched.res.status}).`,
      ),
    };
  } catch (error) {
    console.error(LOG_PREFIX, error);
    return {
      ok: false,
      destId: resourceName,
      error: destNextAction("Google Contacts", "updateContact request failed."),
    };
  }
}

function emailsOnPerson(payload: unknown): string[] {
  if (!isRecord(payload) || !Array.isArray(payload.emailAddresses)) return [];
  return payload.emailAddresses.flatMap((entry) => {
    if (!isRecord(entry) || typeof entry.value !== "string") return [];
    return [entry.value.trim().toLowerCase()];
  });
}

function phonesOnPerson(payload: unknown): string[] {
  if (!isRecord(payload) || !Array.isArray(payload.phoneNumbers)) return [];
  return payload.phoneNumbers.flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const values: string[] = [];
    if (typeof entry.value === "string") values.push(entry.value);
    if (typeof entry.canonicalForm === "string") values.push(entry.canonicalForm);
    return values;
  });
}

type ContactLookup =
  | { ok: true; id: string | null }
  | { ok: false; error: string };

async function searchContacts(
  token: string,
  query: string,
  readMask: string,
  fetchImpl: FetchLike,
): Promise<{ ok: true; results: unknown[] } | { ok: false; error: string }> {
  const params = new URLSearchParams({ query, readMask });
  try {
    const { res, payload } = await peopleRequest(
      `${PEOPLE_URL}/people:searchContacts?${params.toString()}`,
      token,
      fetchImpl,
    );
    if (!res.ok) {
      console.error(LOG_PREFIX, res.status, payload);
      return {
        ok: false,
        error: destNextAction(
          "Google Contacts",
          `searchContacts failed (${res.status}).`,
        ),
      };
    }
    const results = searchContactResults(payload);
    if (!results) {
      console.error(LOG_PREFIX, "searchContacts response was invalid", payload);
      return {
        ok: false,
        error: destNextAction(
          "Google Contacts",
          "searchContacts response was invalid.",
        ),
      };
    }
    return { ok: true, results };
  } catch (error) {
    console.error(LOG_PREFIX, error);
    return {
      ok: false,
      error: destNextAction("Google Contacts", "searchContacts request failed."),
    };
  }
}

function personFromSearchRow(row: unknown): Record<string, unknown> | null {
  if (!isRecord(row) || !isRecord(row.person)) return null;
  return row.person;
}

async function findByEmail(
  token: string,
  email: string,
  fetchImpl: FetchLike,
): Promise<ContactLookup> {
  const searched = await searchContacts(
    token,
    email,
    "names,emailAddresses",
    fetchImpl,
  );
  if (!searched.ok) return searched;
  const wanted = email.trim().toLowerCase();
  for (const row of searched.results) {
    const person = personFromSearchRow(row);
    if (!person) continue;
    const resourceName = personResourceName(person);
    if (resourceName && emailsOnPerson(person).includes(wanted)) {
      return { ok: true, id: resourceName };
    }
  }
  return { ok: true, id: null };
}

async function findByPhone(
  token: string,
  phone: string,
  fetchImpl: FetchLike,
): Promise<ContactLookup> {
  const queries = [phone];
  const digits = normalizePhoneDigits(phone);
  if (digits && digits !== phone) queries.push(digits);
  for (const query of queries) {
    const searched = await searchContacts(
      token,
      query,
      "names,phoneNumbers",
      fetchImpl,
    );
    if (!searched.ok) return searched;
    for (const row of searched.results) {
      const person = personFromSearchRow(row);
      if (!person) continue;
      const resourceName = personResourceName(person);
      if (
        resourceName &&
        phonesOnPerson(person).some((value) => phonesMatch(value, phone))
      ) {
        return { ok: true, id: resourceName };
      }
    }
  }
  return { ok: true, id: null };
}

export async function writeGoogleContact(
  input: { passport: CustomerPassport; storedId: string | null },
  env: EnvMap = process.env,
  fetchImpl: FetchLike = fetch,
): Promise<DestWriteResult> {
  const person = googleContactPerson(input.passport);
  if (Object.keys(person).length === 0) {
    return {
      ok: false,
      destId: input.storedId,
      error: destNextAction(
        "Google Contacts",
        "the passport has no writable fields.",
      ),
    };
  }

  const creds = googleEnv(env);
  if ("error" in creds) {
    console.error(LOG_PREFIX, creds.error);
    return { ok: false, error: creds.error, destId: input.storedId };
  }

  const tokenResult = await accessToken(creds, fetchImpl);
  if ("error" in tokenResult) {
    return { ok: false, error: tokenResult.error, destId: input.storedId };
  }

  if (input.storedId) {
    return updateContact(tokenResult.token, input.storedId, person, fetchImpl);
  }

  const email = presentString(input.passport.email);
  if (email) {
    const found = await findByEmail(tokenResult.token, email, fetchImpl);
    if (!found.ok) {
      return { ok: false, error: found.error, destId: input.storedId };
    }
    if (found.id) {
      return updateContact(tokenResult.token, found.id, person, fetchImpl);
    }
  }

  const phone = presentString(input.passport.phone);
  if (phone) {
    const found = await findByPhone(tokenResult.token, phone, fetchImpl);
    if (!found.ok) {
      return { ok: false, error: found.error, destId: input.storedId };
    }
    if (found.id) {
      return updateContact(tokenResult.token, found.id, person, fetchImpl);
    }
  }

  return createContact(tokenResult.token, person, fetchImpl);
}
