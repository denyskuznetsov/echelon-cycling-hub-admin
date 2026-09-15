# Google Contacts — OAuth setup and recovery

## Correction and recovery (2026-09-15)

The original guide incorrectly paired “stay in Testing” with “authorize once.” Google expires External + Testing authorizations after seven days when Contacts permission is requested. Automatic access-token refresh cannot renew an expired or revoked authorization. The earlier handover's “do not publish” advice does not provide a lasting production connection.

The local configured refresh token returned HTTP 400, `invalid_grant`, “Token has been expired or revoked.” Google Cloud project `echeloncyclinghubadmin` (**EchelonCyclingHubAdmin**) was confirmed to be **External + Testing**. This strongly supports testing expiry, although Google's error does not distinguish expiry from revocation. Testing local credentials does not establish the status of a separate deployment's credentials.

With the user's approval, the project's publishing status was changed to **In production** and verified in Google Cloud on 2026-09-15. The user then replaced the refresh token in Vercel and redeployed production; the deployment was verified as READY. The user subsequently confirmed that saving failed customers again in Booqable successfully synced them to Google. Branding and sensitive-scope verification remain a separate outstanding process: Verification Center requires branding verification first.

Sources: [Google refresh-token expiration](https://developers.google.com/identity/protocols/oauth2#expiration), [publishing status](https://support.google.com/cloud/answer/15549945?hl=en).

Chosen path: the business Google account authorizes access to its shared contacts. The app stores a refresh token and writes to that account's Contacts. Domain-wide delegation is not required for v1.

Use **echeloncyclinghub@gmail.com**, the account that owns the shared contacts, when completing consent.

## 1. Google Cloud project

1. Open [Google Cloud Console](https://console.cloud.google.com/) as that business user.
2. Reuse **EchelonCyclingHubAdmin**, project ID `echeloncyclinghubadmin`.
3. APIs & Services → Library → enable **People API**. That is the current Google Contacts API. The old **Contacts API** (`m8/feeds`) was turned down on 2022-01-19; do not enable it.

## 2. OAuth consent / Data Access

Current Cloud Console puts this under **Google Auth Platform** (Audience + Data Access), not only the old “OAuth consent screen” page.

1. Audience: **External**. For a lasting production connection, the publishing status must be **In production** before obtaining a new refresh token. This change was completed on 2026-09-15. Internal is unavailable unless the Cloud project sits under a Google Cloud organization and does not cover the existing Gmail account.
2. Keep Branding complete. The configured public shop pages are home `https://www.echeloncyclinghub.com` and privacy `https://www.echeloncyclinghub.com/privacy-policy`; the authorized domain is `echeloncyclinghub.com`. Review the current Google verification requirements when submitting branding for review.
3. Data Access → **Add or remove scopes**.
4. Filter `People API` or paste `https://www.googleapis.com/auth/contacts`.
5. Check that one scope only. The user-facing line is usually **See, edit, download, and permanently delete your contacts**. It will land under **Sensitive scopes**. That is expected.
6. Do not add `contacts.readonly`, `contacts.other.readonly`, or directory scopes.
7. **Update**, then **Save** if changing scopes. In a separate Testing project, add the consenting account as a test user and expect to authorize again after seven days.

Publishing permits Google accounts outside the test-user list to authorize the OAuth app. Each must still explicitly consent; this does not grant access to anyone's Contacts or publish the admin app itself. Publishing and verification are separate. Contacts is a sensitive scope: review **Verification Center** and follow the requirements applicable to this use. Google's personal-use exemption covers fewer than 100 users, but a business integration is not automatically exempt merely because it has one connected account. See [verification exemptions](https://support.google.com/cloud/answer/13464323?hl=en) and [verification requirements](https://support.google.com/cloud/answer/13464321?hl=en).

## 3. OAuth client

1. Google Auth Platform → Clients: reuse the existing client matching `GOOGLE_CONTACTS_CLIENT_ID`. Create a client only for an initial setup, not for token expiry.
2. Application type: **Web application**. Name: `echelon-customer-sync`.
3. Confirm the authorized redirect URIs include `https://developers.google.com/oauthplayground`.
4. Use the matching `client_id` and `client_secret` already stored securely. Google Cloud may only display a masked existing secret; do not rotate it merely to replace an expired refresh token.

## 4. Get or replace a refresh token

Use Google's OAuth Playground so you do not have to write a script.

1. Open [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/).
2. Gear icon (top right) → check **Use your own OAuth credentials** → enter the existing client ID and client secret. Keep OAuth endpoints **Google**, flow **Server-side**, access type **Offline**, and force prompt **Consent Screen**. Playground's default client revokes refresh tokens after 24 hours; using your own client avoids that separate limit.
3. Enter only `https://www.googleapis.com/auth/contacts` → **Authorize APIs**.
4. Sign in as **echeloncyclinghub@gmail.com**, the account that owns the shared contacts, and complete consent for the existing Echelon app. If Google requires verification or an administrator blocks access, resolve that requirement. In Testing, `access_denied` can also mean the account is missing from Test users.
5. **Exchange authorization code for tokens**. Copy the **refresh token**, not the access token. Keep credentials out of chat, screenshots, and Git.
6. Click **Refresh access token** once to confirm the replacement works.

Changing publishing status does not restore a token Google already rejects. Obtain a new token after the status change. Source: [OAuth Playground](https://developers.google.com/oauthplayground/).

## 5. Env vars (server-only)

Use these in `.env.local` and the Vercel production environment (not preview):

```
GOOGLE_CONTACTS_CLIENT_ID=...
GOOGLE_CONTACTS_CLIENT_SECRET=...
GOOGLE_CONTACTS_REFRESH_TOKEN=...
```

For recovery, replace `GOOGLE_CONTACTS_REFRESH_TOKEN` and keep the matching client ID/secret. Locally, update the serving checkout's `.env.local` and restart Next.js. In Vercel, open **echelon-cycling-hub-admin → Settings → Environment Variables**, update the **Production** value, then redeploy the intended production revision. [Environment changes apply to new deployments](https://vercel.com/docs/environment-variables). Updating local credentials does not update production. Keep live destination credentials out of Preview/Staging.

Never commit credentials or put them in a bare `.env` file. The app mints short-lived access tokens on each write. Production refresh tokens are long-lived, not guaranteed permanent: revocation, six months of non-use, token limits, and time-limited grants can still require human consent again.

## 6. Check it worked

1. Confirm a refresh-token exchange succeeds in the affected runtime. Report only HTTP status/error code or whether a token was returned; never log tokens.
2. Save one previously failed customer again in Booqable. This retries the existing customer landing flow, including the other destinations.
3. Confirm Google status becomes green in the admin app and the expected contact is present or updated in `echeloncyclinghub@gmail.com`'s Google Contacts.
4. Repeat for other affected customers as needed. Replacing credentials does not replay failed events or clear stored failures. There is no automatic backfill.

## 7. Other token failures

- `invalid_grant`: expired or revoked authorization. Check publishing status and reconnect; not every occurrence proves testing expiry.
- `invalid_client` / `unauthorized_client`: check that the client ID and secret match the client used to issue the token.
- HTTP 429 / 5xx: temporary Google failure or rate limit. Retry later; rotating credentials is not the first recovery action.
- Other HTTP 4xx: inspect the OAuth error code and client configuration before reconnecting.
