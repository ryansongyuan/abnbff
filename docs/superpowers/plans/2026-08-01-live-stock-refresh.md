# Live Stock Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh all ABNB dashboard data on entry and every 60 seconds, fall back to the most recent bundled data when Nasdaq is unavailable, and visibly animate genuine hero-price changes.

**Architecture:** Extract the current Nasdaq transformation into a runtime-safe module, place a tested 60-second cache/fallback service behind `/api/stock`, and let the client atomically replace its complete stock dataset after successful refreshes. Keep the bundled JSON as the immediate initial render and final server fallback; isolate price-direction logic so animation behavior is deterministic and testable.

**Tech Stack:** React 19, Next.js/vinext, Cloudflare Worker runtime, Node test runner, JavaScript runtime modules, TypeScript React components, CSS animations.

## Global Constraints

- Refresh immediately after client mount and every 60 seconds while the page remains open.
- Cache successful upstream results for 60 seconds.
- Never blank or interrupt the page when refresh fails; retain current client data and return bundled data when the server has no successful runtime cache.
- Update the hero quote, market timestamp, annual cards, charts, Top 3, and Bottom 3 atomically from one response.
- Animate only a changed latest price after a refresh; do not animate unchanged or initial bundled values.
- Use red for upward movement and green for downward movement, matching the existing site convention.
- Respect `prefers-reduced-motion`.
- Keep future dates and months empty for an incomplete current year.
- Do not add WebSockets, notifications, trading actions, user-configurable intervals, or paid market-data dependencies.

---

### Task 1: Runtime-safe stock-data transformation

**Files:**
- Create: `lib/stock-data.mjs`
- Modify: `scripts/build-stock-data.mjs`
- Modify: `tests/stock-data.test.mjs`

**Interfaces:**
- Consumes: Nasdaq response shaped as `{ data: { tradesTable: { rows: NasdaqRow[] } } }`.
- Produces: `buildStockData(source, yearsToInclude?)`, `normalizeRows(source)`, and `getAvailableYears(source, minimumYear = 2021)` from `lib/stock-data.mjs`.
- Preserves: CLI usage `node scripts/build-stock-data.mjs input.json output.json`.

- [ ] **Step 1: Extend the stock-data test with validation and automatic-year cases**

Add tests using literal fixtures:

```js
import { buildStockData, getAvailableYears } from "../lib/stock-data.mjs";

test("getAvailableYears returns source years newest first from 2021 onward", () => {
  const multiYear = structuredClone(source);
  multiYear.data.tradesTable.rows.push(
    { date: "12/31/2025", close: "$10.00", open: "$9.00", high: "$11.00", low: "$8.00", volume: "100" },
    { date: "12/31/2020", close: "$8.00", open: "$7.00", high: "$9.00", low: "$6.00", volume: "100" },
  );
  assert.deepEqual(getAvailableYears(multiYear), [2026, 2025]);
});

test("buildStockData rejects a response with no trading rows", () => {
  assert.throws(
    () => buildStockData({ data: { tradesTable: { rows: [] } } }),
    /trading rows/i,
  );
});

test("buildStockData rejects non-numeric market values", () => {
  const invalid = structuredClone(source);
  invalid.data.tradesTable.rows[0].close = "N/A";
  assert.throws(() => buildStockData(invalid, [2026]), /numeric/i);
});
```

- [ ] **Step 2: Run the stock-data test and verify RED**

Run:

```bash
node --test tests/stock-data.test.mjs
```

Expected: FAIL because `lib/stock-data.mjs` does not exist.

- [ ] **Step 3: Move the pure transformation and add strict validation**

Create `lib/stock-data.mjs` with:

```js
const fmtVolume = (value) =>
  value >= 1_000_000_000
    ? `${(value / 1_000_000_000).toFixed(2)}B`
    : `${Math.round(value / 1_000_000)}M`;

const parseMarketNumber = (value) => {
  const parsed = Number(String(value).replace(/[$,]/g, ""));
  if (!Number.isFinite(parsed)) throw new TypeError("Market values must be numeric");
  return parsed;
};

export function normalizeRows(source) {
  const rows = source?.data?.tradesTable?.rows;
  if (!Array.isArray(rows) || rows.length === 0) throw new TypeError("Nasdaq response has no trading rows");
  return rows.map((row) => ({
    date: row.date,
    close: parseMarketNumber(row.close),
    open: parseMarketNumber(row.open),
    high: parseMarketNumber(row.high),
    low: parseMarketNumber(row.low),
    volume: parseMarketNumber(row.volume),
  })).reverse();
}

export function getAvailableYears(source, minimumYear = 2021) {
  return [...new Set(normalizeRows(source).map((row) => Number(row.date.slice(-4))))]
    .filter((year) => Number.isInteger(year) && year >= minimumYear)
    .sort((a, b) => b - a);
}
```

Move the existing annual aggregation into this module. When `yearsToInclude` is omitted, call `getAvailableYears(source)`. Before aggregating a year, reject an empty year selection instead of dereferencing `undefined`.

- [ ] **Step 4: Reduce the CLI script to file I/O only**

Keep `scripts/build-stock-data.mjs` as:

```js
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { buildStockData } from "../lib/stock-data.mjs";

export { buildStockData } from "../lib/stock-data.mjs";

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) throw new Error("Usage: node build-stock-data.mjs input.json output.json");
  fs.writeFileSync(output, JSON.stringify(buildStockData(JSON.parse(fs.readFileSync(input, "utf8")))));
}
```

- [ ] **Step 5: Run the focused and existing tests and verify GREEN**

Run:

```bash
node --test tests/stock-data.test.mjs
```

Expected: all stock-data tests PASS.

- [ ] **Step 6: Commit Task 1**

```bash
git add lib/stock-data.mjs scripts/build-stock-data.mjs tests/stock-data.test.mjs
git commit -m "Extract runtime-safe stock transformation"
```

---

### Task 2: One-minute live-data service with stale fallback

**Files:**
- Create: `lib/live-stock.mjs`
- Create: `tests/live-stock.test.mjs`

**Interfaces:**
- Consumes: `fetchImpl(url, init)`, bundled `fallback`, clock function `now()`, and `buildStockData`.
- Produces: `buildNasdaqHistoricalUrl(date)`, `createStockService(options)`, and async `service.getStockData()` returning `{ ...StockData, fetchedAt, stale }`.

- [ ] **Step 1: Write failing service tests**

Use a complete Nasdaq fixture and a deterministic clock:

```js
import { createStockService } from "../lib/live-stock.mjs";

test("caches a successful normalized response for 60 seconds", async () => {
  let calls = 0;
  let currentTime = 1_000_000;
  const service = createStockService({
    fetchImpl: async () => {
      calls += 1;
      return new Response(JSON.stringify(source), { status: 200 });
    },
    fallback,
    now: () => currentTime,
    ttlMs: 60_000,
  });

  const first = await service.getStockData();
  currentTime += 59_999;
  const second = await service.getStockData();

  assert.equal(calls, 1);
  assert.equal(first.stale, false);
  assert.deepEqual(second, first);
});

test("refetches after the 60 second cache window", async () => {
  let calls = 0;
  let currentTime = 1_000_000;
  const service = createStockService({ fetchImpl: async () => {
    calls += 1;
    return new Response(JSON.stringify(source), { status: 200 });
  }, fallback, now: () => currentTime, ttlMs: 60_000 });

  await service.getStockData();
  currentTime += 60_001;
  await service.getStockData();
  assert.equal(calls, 2);
});

test("returns the most recent successful cache when refresh fails", async () => {
  let fail = false;
  let currentTime = 1_000_000;
  const service = createStockService({ fetchImpl: async () => {
    if (fail) throw new Error("offline");
    return new Response(JSON.stringify(source), { status: 200 });
  }, fallback, now: () => currentTime, ttlMs: 60_000 });
  const fresh = await service.getStockData();
  fail = true;
  currentTime += 60_001;
  const recovered = await service.getStockData();
  assert.equal(recovered.latest, fresh.latest);
  assert.equal(recovered.stale, true);
});

test("returns bundled data as stale when the first upstream request fails", async () => {
  const service = createStockService({
    fetchImpl: async () => new Response("bad gateway", { status: 502 }),
    fallback,
    now: () => 1_000_000,
  });
  const result = await service.getStockData();
  assert.equal(result.latest, fallback.latest);
  assert.equal(result.stale, true);
});

test("shares one in-flight upstream request between concurrent callers", async () => {
  let calls = 0;
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const service = createStockService({
    fetchImpl: async () => {
      calls += 1;
      await pending;
      return new Response(JSON.stringify(source), { status: 200 });
    },
    fallback,
    now: () => 1_000_000,
  });
  const first = service.getStockData();
  const second = service.getStockData();
  release();
  await Promise.all([first, second]);
  assert.equal(calls, 1);
});
```

- [ ] **Step 2: Run the service tests and verify RED**

Run:

```bash
node --test tests/live-stock.test.mjs
```

Expected: FAIL because `lib/live-stock.mjs` does not exist.

- [ ] **Step 3: Implement the service and URL builder**

Use the Nasdaq historical endpoint already represented by the bundled source:

```js
import { buildStockData } from "./stock-data.mjs";

export function buildNasdaqHistoricalUrl(date = new Date()) {
  const to = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York" }).format(date);
  const params = new URLSearchParams({
    assetclass: "stocks",
    fromdate: "01/01/2021",
    limit: "5000",
    todate: to,
  });
  return `https://api.nasdaq.com/api/quote/ABNB/historical?${params}`;
}

export function createStockService({
  fetchImpl = fetch,
  fallback,
  now = Date.now,
  ttlMs = 60_000,
  timeoutMs = 8_000,
}) {
  let cached = null;
  let cachedAt = 0;
  let inFlight = null;

  async function refresh() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(buildNasdaqHistoricalUrl(new Date(now())), {
        headers: { accept: "application/json", "user-agent": "Mozilla/5.0" },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Nasdaq request failed: ${response.status}`);
      const normalized = buildStockData(await response.json());
      cachedAt = now();
      cached = { ...normalized, fetchedAt: new Date(cachedAt).toISOString(), stale: false };
      return cached;
    } finally {
      clearTimeout(timeout);
    }
  }

  async function getStockData() {
    if (cached && now() - cachedAt < ttlMs) return cached;
    try {
      inFlight ??= refresh().finally(() => { inFlight = null; });
      return await inFlight;
    } catch {
      const base = cached ?? fallback;
      return { ...base, fetchedAt: new Date(now()).toISOString(), stale: true };
    }
  }

  return { getStockData };
}
```

- [ ] **Step 4: Run service and stock transformation tests and verify GREEN**

Run:

```bash
node --test tests/live-stock.test.mjs tests/stock-data.test.mjs
```

Expected: all tests PASS, including single-flight behavior when two calls share the same refresh promise.

- [ ] **Step 5: Commit Task 2**

```bash
git add lib/live-stock.mjs tests/live-stock.test.mjs
git commit -m "Add cached live ABNB data service"
```

---

### Task 3: Browser-facing stock API route

**Files:**
- Create: `app/api/stock/route.ts`
- Create: `tests/stock-route.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `createStockService`, `app/abnb-data.json`, and the Worker runtime's global `fetch`.
- Produces: `GET /api/stock` JSON response with `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`.

- [ ] **Step 1: Add a failing built-route integration test**

Extend the existing Worker test helper pattern:

```js
test("GET /api/stock returns a complete stock response with cache policy", async () => {
  const response = await worker.fetch(
    new Request("http://localhost/api/stock", { headers: { accept: "application/json" } }),
    env,
    executionContext,
  );
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control"), /s-maxage=60/);
  assert.equal(typeof body.latest, "number");
  assert.equal(Array.isArray(body.years), true);
  assert.equal(typeof body.stale, "boolean");
  assert.equal(typeof body.fetchedAt, "string");
});
```

- [ ] **Step 2: Build and run the route test to verify RED**

Run:

```bash
pnpm run build && node --test tests/stock-route.test.mjs
```

Expected: FAIL with a 404 because `/api/stock` is absent.

- [ ] **Step 3: Implement the route**

Create `app/api/stock/route.ts`:

```ts
import fallback from "../../abnb-data.json";
import { createStockService } from "../../../lib/live-stock.mjs";

const service = createStockService({ fallback });

export async function GET() {
  const data = await service.getStockData();
  return Response.json(data, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}
```

Create `lib/live-stock.d.mts` with declarations for `StockData`, `StockResponse`, `buildNasdaqHistoricalUrl`, and `createStockService`. Declare `getStockData(): Promise<StockResponse>` and the injected option signatures exactly; do not disable TypeScript checking for the `.mjs` import.

- [ ] **Step 4: Add the new tests to the canonical test command**

Change `package.json` to:

```json
"test": "pnpm run build && node --test tests/stock-data.test.mjs tests/live-stock.test.mjs tests/stock-route.test.mjs tests/bottom-three-html.test.mjs"
```

- [ ] **Step 5: Run the complete test command and verify GREEN**

Run:

```bash
pnpm test
```

Expected: build succeeds and all tests PASS.

- [ ] **Step 6: Commit Task 3**

```bash
git add app/api/stock/route.ts lib/live-stock.d.mts tests/stock-route.test.mjs package.json
git commit -m "Expose cached ABNB stock endpoint"
```

---

### Task 4: Client refresh lifecycle and animated hero price

**Files:**
- Create: `lib/price-transition.mjs`
- Create: `tests/price-transition.test.mjs`
- Modify: `app/page.tsx`
- Modify: `app/globals.css`
- Modify: `package.json`

**Interfaces:**
- Consumes: initial bundled `StockData`, `/api/stock` `StockResponse`, and `getPriceDirection(previous, next)`.
- Produces: refreshed dashboard state, `AnimatedPrice`, and quote direction classes `quote-updating-up` / `quote-updating-down`.

- [ ] **Step 1: Write failing price-transition tests**

```js
import { getPriceDirection } from "../lib/price-transition.mjs";

test("returns up only when the refreshed price increases", () => {
  assert.equal(getPriceDirection(150, 151), "up");
});

test("returns down only when the refreshed price decreases", () => {
  assert.equal(getPriceDirection(151, 150), "down");
});

test("does not animate unchanged or invalid prices", () => {
  assert.equal(getPriceDirection(150, 150), null);
  assert.equal(getPriceDirection(undefined, 150), null);
  assert.equal(getPriceDirection(150, Number.NaN), null);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
node --test tests/price-transition.test.mjs
```

Expected: FAIL because `lib/price-transition.mjs` does not exist.

- [ ] **Step 3: Implement direction logic**

```js
export function getPriceDirection(previous, next) {
  if (!Number.isFinite(previous) || !Number.isFinite(next) || previous === next) return null;
  return next > previous ? "up" : "down";
}
```

- [ ] **Step 4: Replace module-level data use with live state**

In `app/page.tsx`, define `StockData` and `StockResponse`, then initialize:

```tsx
const [liveData, setLiveData] = useState<StockData>(stockData as StockData);
const [priceTransition, setPriceTransition] = useState<{
  previous: number;
  direction: "up" | "down";
  sequence: number;
} | null>(null);
const years = liveData.years;
```

Replace all module-level `YEARS` and `stockData` render references with `years` and `liveData`. Keep the bundled import only as the initial state.

- [ ] **Step 5: Add immediate and one-minute refresh lifecycle**

Add an effect with a single controller per request and no overlapping timer work:

```tsx
useEffect(() => {
  let disposed = false;
  let controller: AbortController | null = null;

  const refresh = async () => {
    controller?.abort();
    controller = new AbortController();
    try {
      const response = await fetch("/api/stock", { signal: controller.signal, cache: "no-store" });
      if (!response.ok) return;
      const next = await response.json() as StockResponse;
      if (!Number.isFinite(next.latest) || !Array.isArray(next.years) || disposed) return;
      setLiveData((current) => {
        const direction = getPriceDirection(current.latest, next.latest);
        if (direction) setPriceTransition({ previous: current.latest, direction, sequence: Date.now() });
        return next;
      });
    } catch (error) {
      if ((error as Error).name !== "AbortError") return;
    }
  };

  void refresh();
  const timer = window.setInterval(() => void refresh(), 60_000);
  return () => { disposed = true; controller?.abort(); window.clearInterval(timer); };
}, []);
```

Clear the transition after 450 ms in a second effect keyed by `priceTransition?.sequence`.

- [ ] **Step 6: Add `AnimatedPrice` and quote direction treatment**

Render both values only during a real transition:

```tsx
function AnimatedPrice({ value, transition }: {
  value: number;
  transition: { previous: number; direction: "up" | "down"; sequence: number } | null;
}) {
  if (!transition) return <span className="price-value">${value.toFixed(2)}</span>;
  return (
    <span className={`price-value price-transition ${transition.direction}`} key={transition.sequence}>
      <span className="price-old">${transition.previous.toFixed(2)}</span>
      <span className="price-new">${value.toFixed(2)}</span>
    </span>
  );
}
```

Use this component in both the hero headline and quote card, and add the matching transition class to `.quote`.

Add CSS:

```css
.price-value { display: inline-grid; position: relative; }
.price-transition > span { grid-area: 1 / 1; }
.price-old { animation: price-out .45s ease forwards; }
.price-new { animation: price-in .45s ease both; }
.quote-updating-up { border-color: rgba(255,56,92,.55); box-shadow: 0 0 38px rgba(255,56,92,.15); }
.quote-updating-down { border-color: rgba(84,209,155,.55); box-shadow: 0 0 38px rgba(84,209,155,.13); }
@keyframes price-out { to { opacity: 0; transform: translateY(-.45em); } }
@keyframes price-in { from { opacity: 0; transform: translateY(.45em); } }
@media (prefers-reduced-motion: reduce) {
  .price-old { display: none; }
  .price-new { animation: none; }
  .quote-updating-up, .quote-updating-down { transition: none; }
}
```

- [ ] **Step 7: Add the transition test to `pnpm test` and verify GREEN**

Update the test script to include `tests/price-transition.test.mjs`, then run:

```bash
pnpm test
```

Expected: build succeeds; stock transformation, service, route, price transition, and rendered HTML tests all PASS.

- [ ] **Step 8: Commit Task 4**

```bash
git add lib/price-transition.mjs tests/price-transition.test.mjs app/page.tsx app/globals.css package.json
git commit -m "Animate live ABNB price refreshes"
```

---

### Task 5: Runtime verification and production release

**Files:**
- Verify: `app/api/stock/route.ts`
- Verify: `app/page.tsx`
- Verify: `app/globals.css`
- Verify: `.openai/hosting.json`

**Interfaces:**
- Consumes: built Worker, local browser preview, existing Sites project ID.
- Produces: verified production deployment of the exact tested commit.

- [ ] **Step 1: Run fresh complete verification**

```bash
pnpm test
git diff --check
git status --short
```

Expected: build succeeds, all tests pass with zero failures, no whitespace errors, and only intended files are changed.

- [ ] **Step 2: Verify API behavior locally**

Start `pnpm run dev`, request `/api/stock` twice inside 60 seconds, and verify:

```text
status: 200
cache-control includes s-maxage=60
latest is numeric
years includes every available year from newest through 2021
fetchedAt is an ISO timestamp
stale is boolean
```

- [ ] **Step 3: Verify the refresh interaction in the Browser plugin**

Use a controlled local response or development-only fetch interception to return a changed latest price after initial render. Confirm:

```text
page renders bundled data immediately
initial /api/stock request occurs
changed price triggers the correct red-up or green-down transition
unchanged price causes no transition
all annual cards update from the same response
navigation still scrolls to every generated year
console has no relevant warnings or errors
390px and desktop layouts have no horizontal overflow
reduced-motion shows the new value without movement
```

- [ ] **Step 4: Commit any verification-only fixes, then rerun the full suite**

```bash
pnpm test
git diff --check
```

Expected: all checks remain green after the final source state.

- [ ] **Step 5: Push and deploy the exact commit with Sites**

Use the existing `project_id` from `.openai/hosting.json`. Obtain a short-lived source credential, push the current `main` HEAD, package with:

```bash
/Users/ryan/.codex/plugins/cache/openai-bundled/sites/0.1.33/scripts/package-site.sh \
  /Users/ryan/Desktop/abnb-stock-tracker \
  /private/tmp/abnb-live-refresh.tar.gz
```

Save one version using the pushed commit SHA and archive, deploy it privately, poll until `succeeded`, and open the returned production URL in Codex.

- [ ] **Step 6: Report the production result**

Report the deployed URL, one-minute refresh behavior, stale fallback, price animation behavior, and fresh test/build evidence. Do not claim exchange-grade real-time pricing; describe it as one-minute automatic refresh using the source's available market timestamp.
