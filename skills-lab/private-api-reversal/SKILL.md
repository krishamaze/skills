---
name: private-api-reversal
description: >
  Methodology for reverse-engineering the private/undocumented HTTP API of any web application
  and building a programmatic client that replays those requests. Use this skill whenever a user
  wants to automate a web product that has no public API, build an unofficial client for a web
  service, intercept and replay browser requests programmatically, or asks how to "do what
  notebooklm-py did" for any other product (Flow, Perplexity, CapCut, etc.). Also trigger for
  questions about extracting auth tokens from browsers, decoding private API request formats,
  handling CSRF tokens, or building TypeScript/Python clients around undocumented endpoints.
  Trigger even for partial phrases like "automate X without an API", "reverse engineer X", or
  "how does X talk to its backend".
---

# Private API Reversal — Methodology

This skill is the generic methodology. No assumptions about any specific product.
For Google-specific batchexecute protocol, see `google-batchexecute-rpc` skill (if available).

---

## What This Is (And Is Not)

**What it is:** Every web app has a frontend that talks to a backend over HTTP. That traffic is
visible in your browser. This skill is about observing that traffic, understanding its structure,
and writing code that reproduces it — replacing the human clicking in the browser with your
programmatic client.

**What it is not:**
- It is not exploiting security vulnerabilities
- It is not bypassing encryption
- It is not accessing data you don't have permission to access
- It does not work on apps using client-side request signing with secrets not visible in the browser

**Honest limits stated up front:**
- Some apps use Cloudflare Bot Management, TLS fingerprinting, or behavioural analysis that
  detects non-browser clients. This methodology does not defeat those.
- Session cookies and tokens expire. Your client needs a refresh strategy.
- Apps change their internal APIs without notice. Private clients break silently.
- Terms of Service: check before building. Many products explicitly forbid automated access.

---

## Phase 1 — Reconnaissance (What to capture in DevTools)

### Setup
1. Open Chrome (not Firefox — Chrome DevTools has better request inspection)
2. Open DevTools: `Cmd+Option+I` / `Ctrl+Shift+I`
3. Go to **Network** tab
4. Check **Preserve log** (top-left checkbox) — prevents log clearing on navigation
5. Filter: start with **Fetch/XHR** — ignores static assets, shows only API calls

### What to do
Perform each action you want to automate in the UI, one at a time, watching which network
requests fire. For each action you care about:

1. Click the request in the Network tab
2. Capture from **Headers** tab:
   - Full request URL
   - HTTP method (GET/POST/PUT etc.)
   - All request headers — especially `Cookie`, `Authorization`, `Content-Type`, `X-*` custom headers
3. Capture from **Payload** tab (POST requests):
   - Request body format: JSON? Form-encoded? Multipart? Protobuf?
   - Exact field names and value shapes
4. Capture from **Response** tab:
   - Response format: JSON? Streamed chunks? XML? Binary?
   - Structure of the data you need
5. Right-click the request → **Copy → Copy as cURL** — gives you a complete runnable command
   you can paste into a terminal to verify the request works outside the browser

### What to look for specifically

**The endpoint URL pattern:**
```
https://app.example.com/_/AppName/data/batchexecute   ← Google RPC pattern
https://api.example.com/v1/resource                    ← REST pattern
https://app.example.com/graphql                        ← GraphQL
https://app.example.com/api/chat/completions           ← OpenAI-style streaming
```

**Auth signal locations** — look in ALL of these:
| Location | What you might find |
|---|---|
| `Cookie` header | Session cookies (SID, HSID, __Secure-*, cf_clearance) |
| `Authorization` header | `Bearer <jwt>` or `Basic <base64>` |
| Custom headers | `X-CSRF-Token`, `X-Request-ID`, `X-App-Token` |
| Request body | `csrf_token`, `at=<token>`, `_token` fields |
| URL params | `?token=`, `?key=`, `?sid=` |

**CSRF tokens specifically** — always scrape from the page, not hardcode:
- View page source (`Cmd+U`): search for `csrf`, `_token`, `SNlM0e`, `xsrf`
- DevTools Application tab → Storage → Local Storage / Session Storage
- DevTools Application tab → Cookies

### Tools beyond DevTools (when you need them)

| Tool | When to use |
|---|---|
| **mitmproxy** | Mobile apps, Electron apps, or when DevTools is insufficient |
| **Postman Proxy** | Capture streams of requests from multiple clients |
| **Burp Suite** | Deep inspection, request mutation, replay with modifications |
| **Playwright** | When you need a real browser for JS execution but want to intercept traffic |

---

## Phase 2 — Auth Extraction

Authentication in web apps falls into five patterns. Identify which one you're dealing with:

### Pattern A — Session Cookies (most common for Google, social platforms)
**What it looks like:** `Cookie: SID=xxx; HSID=yyy; SSID=zzz`

**How to extract programmatically:**
- Use Playwright to log in as a real user, save the browser storage state to a JSON file
- Load that JSON in your client: parse cookies, build `Cookie` header string
- Store the file securely — it contains your full session

```typescript
// Playwright: save after login
await context.storageState({ path: 'auth.json' });

// Your client: load
const storage = JSON.parse(fs.readFileSync('auth.json'));
const cookies = storage.cookies
  .map((c: any) => `${c.name}=${c.value}`)
  .join('; ');
```

**Additional tokens scraped from page HTML** (common in Google products):
```typescript
// Fetch the app homepage with your cookies, then regex for tokens
const html = await fetch(baseUrl, { headers: { Cookie: cookies } }).then(r => r.text());
const csrfToken = html.match(/"SNlM0e":"([^"]+)"/)?.[1];  // Google CSRF pattern
const sessionId = html.match(/"FdrFJe":"([^"]+)"/)?.[1];  // Google session ID
```

### Pattern B — Bearer JWT (REST APIs, newer products)
**What it looks like:** `Authorization: Bearer eyJhbGc...`

**Extraction:**
- DevTools → Application → Local Storage → look for `token`, `access_token`, `jwt`
- Or captured directly from a `/login` or `/auth/token` response body
- JWTs expire — your client needs to call the refresh endpoint and swap the token

```typescript
// Decode without verifying (inspection only — never trust unverified JWTs for auth decisions)
const payload = JSON.parse(atob(token.split('.')[1]));
console.log('Expires:', new Date(payload.exp * 1000));
```

### Pattern C — API Key in Header
**What it looks like:** `X-API-Key: abc123` or `api-key: abc123`

Simplest case — extract once, store in env var, add to every request.

### Pattern D — Form-encoded CSRF token in body
**What it looks like:** Request body contains `at=XXXXXXXX&f.req=...` (Google batchexecute)

- Scraped from page HTML (see Pattern A above for extraction)
- Re-scraped on session refresh — tokens rotate with sessions

### Pattern E — Dynamic request signing
**What it looks like:** `X-Signature: <hash>` that changes every request

This is the hard case. The signature is computed in the app's JavaScript using a secret or a
deterministic function. You must:
1. Find the signing function in the minified JS (DevTools → Sources → search for the header name)
2. Understand what inputs it hashes (timestamp + nonce + body + secret?)
3. Replicate the hash in your client

**This is genuinely difficult.** If you hit this pattern, consider using Playwright to run a real
browser and intercept requests via `page.on('request')` instead of replicating the signing.

---

## Phase 3 — Request Structure Analysis

### Identify the protocol

| Signal | Protocol | How to handle |
|---|---|---|
| URL contains `/graphql` | GraphQL | Use introspection query to get schema |
| Body is `f.req=...` URL-encoded | Google batchexecute RPC | See google-batchexecute-rpc skill |
| Body is `{"query": "...", "variables": {...}}` | GraphQL | Standard GraphQL client |
| Body is flat JSON `{"key": "value"}` | REST | Straightforward — replicate body shape |
| Response starts with `)]}'\n` | Google APIs | Strip that prefix before JSON.parse |
| Response is `data: {...}\n\n` chunks | SSE streaming | Read as stream, parse each `data:` line |
| Response is binary chunks over single connection | WebSocket | Different tooling — use `ws` library |
| Body is multipart/form-data | File upload endpoint | Use FormData in fetch |

### What parameters are required vs optional

Test this by replaying the cURL capture with headers removed one at a time. A 200 without a
header = it was optional. A 401/403/400 = it was required.

The minimum viable request is the most stable. More headers = more breakage surface.

### Pagination and async jobs

Many API actions are async — you submit a job and poll for results:
```
POST /generate → { jobId: "abc123" }
    ↓ poll every 2s
GET /status?jobId=abc123 → { status: "pending" }
GET /status?jobId=abc123 → { status: "pending" }
GET /status?jobId=abc123 → { status: "done", outputUrl: "..." }
```

Capture BOTH the submission request and all the subsequent polling requests.

---

## Phase 4 — Building the Client

### Structure every client the same way

```
your-product-client/
├── auth.ts          ← load cookies/tokens, scrape page tokens, refresh logic
├── encoder.ts       ← build request body for each action
├── decoder.ts       ← parse response format, strip envelopes, handle errors
├── client.ts        ← the public API your pipeline code calls
└── types.ts         ← TypeScript types for requests and responses
```

### auth.ts pattern
```typescript
export interface AuthTokens {
  cookies: Record<string, string>;
  csrfToken?: string;
  sessionId?: string;
  bearerToken?: string;
  expiresAt?: Date;
}

export async function loadAuth(storagePath: string): Promise<AuthTokens> {
  // Load from Playwright storage state or your own JSON store
}

export async function refreshIfNeeded(auth: AuthTokens): Promise<AuthTokens> {
  // Check expiry, call refresh endpoint, return updated tokens
}

export function buildHeaders(auth: AuthTokens): Record<string, string> {
  // Build the exact headers your captured requests require
}
```

### decoder.ts — handle every response format
```typescript
export function decodeResponse(raw: string, format: 'json' | 'google-rpc' | 'sse'): any {
  if (format === 'google-rpc') {
    // Strip )]}'\n prefix, parse outer array, extract payload
    const clean = raw.replace(/^\)]\}'\n/, '');
    // ... see google-batchexecute-rpc skill for full decoder
  }
  if (format === 'sse') {
    return raw.split('\n')
      .filter(line => line.startsWith('data: '))
      .map(line => JSON.parse(line.slice(6)));
  }
  return JSON.parse(raw);
}
```

### Error handling — the four cases you will always hit
```typescript
// 1. Auth expired — re-login and retry once
if (response.status === 401 || response.status === 403) {
  auth = await refreshAuth();
  return retry(request, auth);
}

// 2. Rate limiting
if (response.status === 429) {
  const retryAfter = response.headers.get('retry-after') ?? '60';
  await sleep(parseInt(retryAfter) * 1000);
  return retry(request, auth);
}

// 3. Server error — retry with backoff
if (response.status >= 500) {
  await sleep(exponentialBackoff(attempt));
  return retry(request, auth, attempt + 1);
}

// 4. Response format changed (app deployed an update)
// — this breaks silently. Log the raw response before parsing.
console.log('[decoder] raw response:', rawText.slice(0, 200));
```

---

## Phase 5 — Stability and Maintenance

**Private APIs break without warning.** Build defensively:

### What breaks and how to detect it fast
| What changes | Symptom | Detection |
|---|---|---|
| Token name renamed | 401 on all requests | Health check endpoint, alert on auth fail |
| Request body field renamed | 400 Bad Request or silent wrong result | Validate response shape, not just status 200 |
| Response structure changed | JSON parse error or missing fields | Schema validation on decoded response |
| New required header added | 403 or app-specific error code | Log raw responses, inspect error body |
| Endpoint path changed | 404 | Monitor for 404s in production |

### The minimal health check
```typescript
// Run this on startup and periodically
async function healthCheck(client: YourClient): Promise<boolean> {
  try {
    const result = await client.someSimpleReadOperation();
    return result !== null;
  } catch (e) {
    console.error('[health] client broken:', e.message);
    return false;
  }
}
```

### Auth rotation
Session cookies expire — typically 30 days to 1 year. JWTs expire faster (minutes to hours).
Build a scheduled job that:
1. Checks if auth is within 24h of expiry
2. If so, uses Playwright to re-login and saves fresh cookies
3. Updates the stored auth file/record
4. Notifies you if re-login fails

---

## Recon Checklist — One Action at a Time

For each UI action you want to automate, capture:

- [ ] Full URL (copy from address bar in Network tab)
- [ ] HTTP method
- [ ] All headers (Headers tab → expand Request Headers)
- [ ] Request body (Payload tab — check both Form Data and Raw views)
- [ ] Response format and shape (Response tab — prettify JSON)
- [ ] cURL copy (right-click request → Copy → Copy as cURL)
- [ ] Any subsequent polling requests after async submission
- [ ] The download/result URL format from the completed job

Minimum to capture per project:
- [ ] Login flow (to understand cookie/token acquisition)
- [ ] One read operation (list/get)
- [ ] One write operation (create/submit)
- [ ] One async job + poll cycle (if the product has async generation)
- [ ] One file upload (if the product accepts files)

---

## What This Skill Does Not Cover

- **Mobile app APIs**: require mitmproxy + certificate pinning bypass (different skill)
- **Electron app APIs**: similar to web but open DevTools via `--inspect` flag
- **WebSocket-heavy apps**: require `ws` library and different capture approach
- **Apps with client-side request signing**: require JS deobfuscation (different skill)
- **Anti-bot systems** (Cloudflare Bot Management, DataDome, Akamai): this methodology
  does not defeat them — requires headless browser with real fingerprint or different approach
